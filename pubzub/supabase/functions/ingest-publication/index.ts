import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Simple hash function for API key validation
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const VALID_STAGES = [
  "idea",
  "draft",
  "submitted",
  "revise_resubmit",
  "resubmitted",
  "accepted",
  "published",
];

// Map common stage aliases
function normalizeStage(stage: string): string {
  const map: Record<string, string> = {
    idea: "idea",
    ideas: "idea",
    draft: "draft",
    drafting: "draft",
    "in-progress": "draft",
    "work-in-progress": "draft",
    wip: "draft",
    submitted: "submitted",
    "under-review": "submitted",
    "under review": "submitted",
    revise: "revise_resubmit",
    "revise-resubmit": "revise_resubmit",
    "revise_resubmit": "revise_resubmit",
    "r&r": "revise_resubmit",
    "revise and resubmit": "revise_resubmit",
    resubmitted: "resubmitted",
    accepted: "accepted",
    forthcoming: "accepted",
    published: "published",
  };
  const normalized = map[stage.toLowerCase().trim()];
  if (normalized) return normalized;
  if (VALID_STAGES.includes(stage.toLowerCase().trim()))
    return stage.toLowerCase().trim();
  return "idea"; // default
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
    // Authenticate via API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-api-key header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const keyHash = await hashKey(apiKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate API key
    const { data: userId, error: keyError } = await supabase.rpc(
      "validate_api_key",
      { _key_hash: keyHash }
    );

    if (keyError || !userId) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash);

    // Parse body
    const body = await req.json();
    const {
      title,
      authors,
      stage,
      notes,
      output_type,
      target_year,
      themes,
      grants,
      overleaf_url,
      github_repo,
      links,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "title is required and must be a non-empty string" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedStage = stage ? normalizeStage(stage) : undefined;

    // Try to find existing publication by title (case-insensitive)
    const { data: existing } = await supabase
      .from("publications")
      .select("id, title, stage")
      .eq("owner_id", userId)
      .ilike("title", title.trim())
      .limit(1)
      .single();

    const pubData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only set fields that were provided
    if (authors !== undefined)
      pubData.authors = Array.isArray(authors) ? authors : [authors];
    if (normalizedStage) pubData.stage = normalizedStage;
    if (notes !== undefined) pubData.notes = notes;
    if (output_type !== undefined) pubData.output_type = output_type;
    if (target_year !== undefined) pubData.target_year = target_year;
    if (themes !== undefined)
      pubData.themes = Array.isArray(themes) ? themes : [themes];
    if (grants !== undefined)
      pubData.grants = Array.isArray(grants) ? grants : [grants];
    if (overleaf_url !== undefined) pubData.overleaf_link = overleaf_url;
    if (github_repo !== undefined) pubData.github_repo = github_repo;
    if (links !== undefined)
      pubData.links = Array.isArray(links) ? links : [links];

    let resultId: string;
    let action: string;

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from("publications")
        .update(pubData)
        .eq("id", existing.id);

      if (updateError) throw updateError;
      resultId = existing.id;
      action = "updated";
    } else {
      // Create new
      pubData.title = title.trim();
      pubData.owner_id = userId;
      if (!pubData.stage) pubData.stage = "idea";

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
      source: "api",
      action,
      publication_id: resultId,
      publication_title: title.trim(),
      details: { stage: normalizedStage || existing?.stage || "idea" },
      pubzub_yaml_detected: false,
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        publication_id: resultId,
        stage: normalizedStage || existing?.stage || "idea",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
