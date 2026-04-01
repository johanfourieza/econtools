import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const VALID_STAGES = [
  "idea", "draft", "submitted", "revise_resubmit",
  "resubmitted", "accepted", "published",
];

// Map common stage aliases
function normalizeStage(stage: string): string | null {
  const map: Record<string, string> = {
    idea: "idea", draft: "draft", wip: "draft",
    submitted: "submitted", "under-review": "submitted",
    revise_resubmit: "revise_resubmit", "revise-resubmit": "revise_resubmit",
    "r&r": "revise_resubmit", resubmitted: "resubmitted",
    accepted: "accepted", forthcoming: "accepted",
    published: "published",
  };
  const key = stage.toLowerCase().trim();
  return map[key] || (VALID_STAGES.includes(key) ? key : null);
}

// Verify GitHub webhook HMAC-SHA256 signature
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed =
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  // Constant-time comparison
  if (computed.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// Convert repo name to human-readable title
function repoNameToTitle(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Extract [stage:xxx] tag from commit message
function extractStageTag(message: string): string | null {
  const match = message.match(/\[stage:([^\]]+)\]/i);
  if (!match) return null;
  return normalizeStage(match[1]);
}

// Fetch and parse .pubzub.yaml from a GitHub repo's default branch
interface PubzubYaml {
  title?: string;
  authors?: string[];
  stage?: string;
  output_type?: string;
  target_year?: number;
  themes?: string[];
  grants?: string[];
  notes?: string;
  overleaf_url?: string;
  links?: string[];
}

async function fetchPubzubYaml(
  repoFullName: string,
  defaultBranch: string
): Promise<PubzubYaml | null> {
  try {
    const url = `https://raw.githubusercontent.com/${repoFullName}/${defaultBranch}/.pubzub.yaml`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "PubZub-Webhook/1.0" },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    return parseSimpleYaml(text);
  } catch {
    return null;
  }
}

// Minimal YAML parser for flat key-value + simple arrays (no dependency needed)
function parseSimpleYaml(text: string): PubzubYaml {
  const result: Record<string, unknown> = {};
  const lines = text.split("\n");
  let currentKey = "";
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith("#") || line.trim() === "") {
      if (currentArray && currentKey) {
        result[currentKey] = currentArray;
        currentArray = null;
        currentKey = "";
      }
      continue;
    }

    // Array item
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      if (!currentArray) currentArray = [];
      currentArray.push(arrayMatch[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    // Flush previous array
    if (currentArray && currentKey) {
      result[currentKey] = currentArray;
      currentArray = null;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const val = kvMatch[2].trim();
      if (val === "" || val === "[]") {
        // Start of an array or empty value
        currentKey = key;
        currentArray = val === "[]" ? [] : null;
      } else {
        // Scalar value
        const cleaned = val.replace(/^["']|["']$/g, "");
        if (cleaned === "true") result[key] = true;
        else if (cleaned === "false") result[key] = false;
        else if (/^\d+$/.test(cleaned)) result[key] = parseInt(cleaned, 10);
        else result[key] = cleaned;
        currentKey = "";
      }
    }
  }

  // Flush trailing array
  if (currentArray && currentKey) {
    result[currentKey] = currentArray;
  }

  return result as PubzubYaml;
}

// Hash function for API key validation (same as ingest-publication)
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();

    // --- Authentication: GitHub signature OR API key ---
    const ghSignature = req.headers.get("x-hub-signature-256");
    const apiKey = req.headers.get("x-api-key");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string;

    if (ghSignature) {
      // GitHub webhook authentication via HMAC signature
      const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
      if (!webhookSecret) {
        console.error("GITHUB_WEBHOOK_SECRET not configured");
        return new Response(
          JSON.stringify({ error: "Webhook secret not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const valid = await verifySignature(rawBody, ghSignature, webhookSecret);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For GitHub webhooks, we need the user's API key in a query param to identify the user
      const url = new URL(req.url);
      const userApiKey = url.searchParams.get("api_key");
      if (!userApiKey) {
        return new Response(
          JSON.stringify({ error: "Missing api_key query parameter. Add ?api_key=YOUR_KEY to the webhook URL." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const keyHash = await hashKey(userApiKey);
      const { data: validatedUserId, error: keyError } = await supabase.rpc(
        "validate_api_key",
        { _key_hash: keyHash }
      );

      if (keyError || !validatedUserId) {
        return new Response(JSON.stringify({ error: "Invalid API key in webhook URL" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = validatedUserId;

      // Update last_used_at
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_hash", keyHash);
    } else if (apiKey) {
      // Direct API key authentication (for testing / manual calls)
      const keyHash = await hashKey(apiKey);
      const { data: validatedUserId, error: keyError } = await supabase.rpc(
        "validate_api_key",
        { _key_hash: keyHash }
      );

      if (keyError || !validatedUserId) {
        return new Response(JSON.stringify({ error: "Invalid API key" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = validatedUserId;

      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_hash", keyHash);
    } else {
      return new Response(
        JSON.stringify({ error: "Missing authentication. Provide x-hub-signature-256 (GitHub) or x-api-key header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the payload
    const body = JSON.parse(rawBody);

    // Check if this is a GitHub webhook event
    const ghEvent = req.headers.get("x-github-event");

    if (ghEvent) {
      // Only process push events
      if (ghEvent === "ping") {
        return new Response(
          JSON.stringify({ success: true, message: "Pong! Webhook is connected." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (ghEvent !== "push") {
        return new Response(
          JSON.stringify({ skipped: true, reason: `Event '${ghEvent}' is not processed. Only 'push' events are handled.` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract data from GitHub push event
      const repo = body.repository;
      const repoName = repo?.name || "";
      const repoFullName = repo?.full_name || "";
      const repoUrl = repo?.html_url || "";
      const defaultBranch = repo?.default_branch || "main";
      const commits = body.commits || [];

      // Check if .pubzub.yaml was added/modified in this push
      const yamlTouched = commits.some((c: any) =>
        [...(c.added || []), ...(c.modified || [])].includes(".pubzub.yaml")
      );

      // Fetch .pubzub.yaml from repo (always try, but prioritize if touched)
      const yamlConfig = await fetchPubzubYaml(repoFullName, defaultBranch);

      // Title: .pubzub.yaml > repo name
      const title = yamlConfig?.title || repoNameToTitle(repoName);

      // Check all commits for stage tags (use the latest one found)
      let stage: string | null = null;
      let latestMessage = "";
      for (const commit of commits) {
        const extracted = extractStageTag(commit.message || "");
        if (extracted) {
          stage = extracted;
        }
        latestMessage = commit.message || latestMessage;
      }

      // Stage priority: commit tag > .pubzub.yaml > existing
      if (!stage && yamlConfig?.stage) {
        const normalized = normalizeStage(yamlConfig.stage);
        if (normalized) stage = normalized;
      }

      // Try to find existing publication by title (case-insensitive)
      const { data: existing } = await supabase
        .from("publications")
        .select("id, title, stage, github_repo")
        .eq("owner_id", userId)
        .ilike("title", title)
        .limit(1)
        .single();

      // Also try matching by github_repo URL
      let existingByRepo = null;
      if (!existing && repoUrl) {
        const { data: byRepo } = await supabase
          .from("publications")
          .select("id, title, stage, github_repo")
          .eq("owner_id", userId)
          .eq("github_repo", repoUrl)
          .limit(1)
          .single();
        existingByRepo = byRepo;
      }

      const match = existing || existingByRepo;

      const pubData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        github_repo: repoUrl,
      };

      // Apply .pubzub.yaml metadata (lower priority than explicit API fields)
      if (yamlConfig) {
        if (yamlConfig.authors) pubData.authors = yamlConfig.authors;
        if (yamlConfig.output_type) pubData.output_type = yamlConfig.output_type;
        if (yamlConfig.target_year) pubData.target_year = yamlConfig.target_year;
        if (yamlConfig.themes) pubData.themes = yamlConfig.themes;
        if (yamlConfig.grants) pubData.grants = yamlConfig.grants;
        if (yamlConfig.notes) pubData.notes = yamlConfig.notes;
        if (yamlConfig.overleaf_url) pubData.overleaf_link = yamlConfig.overleaf_url;
        if (yamlConfig.links) pubData.links = yamlConfig.links;
      }

      if (stage) {
        pubData.stage = stage;
        // Add stage history entry
        pubData.stage_history = match?.stage && match.stage !== stage
          ? [{ from: match.stage, to: stage, at: new Date().toISOString() }]
          : undefined;
      }

      // Add commit info to notes if no existing notes or append
      const commitNote = `[GitHub] ${latestMessage} (${new Date().toISOString().split("T")[0]})`;

      let resultId: string;
      let action: string;

      if (match) {
        // Don't overwrite stage_history, append instead
        if (pubData.stage_history) {
          // We can't easily append in a single update, so just set the new entry
          // The client-side handles full history
        }
        delete pubData.stage_history;

        const { error: updateError } = await supabase
          .from("publications")
          .update(pubData)
          .eq("id", match.id);

        if (updateError) throw updateError;
        resultId = match.id;
        action = "updated";
      } else {
        // Create new publication
        pubData.title = title;
        pubData.owner_id = userId;
        pubData.stage = stage || "idea";

        const { data: created, error: createError } = await supabase
          .from("publications")
          .insert(pubData)
          .select("id")
          .single();

        if (createError) throw createError;
        resultId = created.id;
        action = "created";
      }

      // Log activity
      await supabase.from("activity_log").insert({
        user_id: userId,
        source: "webhook",
        action,
        publication_id: resultId,
        publication_title: title,
        details: {
          stage: stage || match?.stage || "idea",
          commit_message: latestMessage,
          repo: repoFullName,
        },
        pubzub_yaml_detected: !!yamlConfig,
      });

      return new Response(
        JSON.stringify({
          success: true,
          action,
          publication_id: resultId,
          title,
          stage: stage || match?.stage || "idea",
          commit_message: latestMessage,
          pubzub_yaml_detected: !!yamlConfig,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not a GitHub event, return error
    return new Response(
      JSON.stringify({ error: "Not a recognized GitHub webhook event. Missing x-github-event header." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("GitHub webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
