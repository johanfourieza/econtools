import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStage, appendStageHistory } from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-kabbo-source",
};

// The MCP server proxies to this function; it tags its calls so the activity
// log attributes them to the agent rather than to a raw API client.
function activitySource(req: Request): "api" | "mcp" {
  return req.headers.get("x-kabbo-source") === "mcp" ? "mcp" : "api";
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateRequest(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { error: "Missing x-api-key header", status: 401 };

  const keyHash = await hashKey(apiKey);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: userId, error } = await supabase.rpc("validate_api_key", {
    _key_hash: keyHash,
  });

  if (error || !userId) return { error: "Invalid API key", status: 401 };

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash);

  return { userId, supabase };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// GET: List/search publications
async function handleGet(
  req: Request,
  url: URL,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const id = url.searchParams.get("id");
  const q = url.searchParams.get("q");
  const stage = url.searchParams.get("stage");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Single publication by ID
  if (id) {
    const { data, error } = await supabase
      .from("publications")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .single();

    if (error || !data) return jsonResponse({ error: "Publication not found" }, 404);
    return jsonResponse({ publication: data });
  }

  // List with optional filters
  let query = supabase
    .from("publications")
    .select("id, title, stage, authors, themes, grants, target_year, target_journal, output_type, notes, github_repo, overleaf_link, created_at, updated_at", { count: "exact" })
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  if (stage) {
    const normalized = normalizeStage(stage);
    if (normalized) query = query.eq("stage", normalized);
  }

  const { data, error, count } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  // Log list activity (don't log individual GETs to reduce noise)
  if (!id) {
    await supabase.from("activity_log").insert({
      user_id: userId,
      source: activitySource(req),
      action: "listed",
      details: { query: q, stage, limit, offset, total: count },
      kabbo_yaml_detected: false,
    });
  }

  return jsonResponse({ publications: data, total: count, limit, offset });
}

// PATCH: Update a publication
async function handlePatch(
  req: Request,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const body = await req.json();
  const { id, title, authors, stage, notes, output_type, target_year, target_journal, themes, grants, overleaf_url, github_repo, links } = body;

  if (!id) return jsonResponse({ error: "id is required" }, 400);

  // Verify ownership (and read the current stage, history and year so we can
  // record the transition and honour the published-requires-year CHECK below).
  const { data: existing } = await supabase
    .from("publications")
    .select("id, stage, stage_history, target_year")
    .eq("id", id)
    .eq("owner_id", userId)
    .single();

  if (!existing) return jsonResponse({ error: "Publication not found or not owned by you" }, 404);

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };

  if (title !== undefined) updates.title = title;
  if (authors !== undefined) updates.authors = Array.isArray(authors) ? authors : [authors];
  if (stage !== undefined) {
    const normalized = normalizeStage(stage);
    if (!normalized) return jsonResponse({ error: `Invalid stage: ${stage}` }, 400);
    if (normalized !== existing.stage) {
      updates.stage = normalized;
      // Same {from,to,at} shape the web client writes, so time-in-stage
      // analytics see agent-driven moves too.
      updates.stage_history = appendStageHistory(existing.stage_history, existing.stage, normalized, now);
    }
  }
  if (notes !== undefined) updates.notes = notes;
  if (output_type !== undefined) updates.output_type = output_type;
  if (target_year !== undefined) updates.target_year = target_year;
  if (target_journal !== undefined) updates.target_journal = target_journal;
  if (themes !== undefined) updates.themes = Array.isArray(themes) ? themes : [themes];
  if (grants !== undefined) updates.grants = Array.isArray(grants) ? grants : [grants];
  if (overleaf_url !== undefined) updates.overleaf_link = overleaf_url;
  if (github_repo !== undefined) updates.github_repo = github_repo;
  // Links are stored as JSON strings client-side (dbToLocal JSON.parses them);
  // stringify any object here so they don't come back as "[object Object]".
  if (links !== undefined) {
    const arr = Array.isArray(links) ? links : [links];
    updates.links = arr.map((l) => (typeof l === "string" ? l : JSON.stringify(l)));
  }

  // The DB CHECK forbids a published row with a null target_year. If this PATCH
  // moves the row to published without a year, default to the current one
  // (mirrors the web client) rather than letting Postgres 500.
  if (updates.stage === "published") {
    const yr = (updates.target_year as number | null | undefined) ?? existing.target_year;
    updates.target_year = yr ?? new Date().getFullYear();
  }

  const { error } = await supabase.from("publications").update(updates).eq("id", id);
  if (error) return jsonResponse({ error: error.message }, 500);

  // Log activity
  const { data: pub } = await supabase.from("publications").select("title").eq("id", id).single();
  await supabase.from("activity_log").insert({
    user_id: userId,
    source: activitySource(req),
    action: updates.stage ? "stage_changed" : "updated",
    publication_id: id,
    publication_title: pub?.title,
    details: updates.stage
      ? { from: existing.stage, stage: updates.stage }
      : { fields: Object.keys(updates).filter(k => k !== "updated_at") },
    kabbo_yaml_detected: false,
  });

  return jsonResponse({ success: true, publication_id: id, stage: updates.stage ?? existing.stage });
}

// DELETE: Bin a publication
async function handleDelete(
  req: Request,
  userId: string,
  supabase: ReturnType<typeof createClient>
) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) return jsonResponse({ error: "id query parameter is required" }, 400);

  // Fetch the publication
  const { data: pub } = await supabase
    .from("publications")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .single();

  if (!pub) return jsonResponse({ error: "Publication not found or not owned by you" }, 404);

  // Move to bin
  const { error: binError } = await supabase.from("publication_bin").insert({
    user_id: userId,
    original_stage: pub.stage,
    publication_data: pub,
  });

  if (binError) return jsonResponse({ error: binError.message }, 500);

  // Delete the publication
  const { error: delError } = await supabase.from("publications").delete().eq("id", id);
  if (delError) return jsonResponse({ error: delError.message }, 500);

  // Log activity
  await supabase.from("activity_log").insert({
    user_id: userId,
    source: activitySource(req),
    action: "deleted",
    publication_id: id,
    publication_title: pub.title,
    details: { previous_stage: pub.stage },
    kabbo_yaml_detected: false,
  });

  return jsonResponse({ success: true, action: "binned", publication_id: id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateRequest(req);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

    const { userId, supabase } = auth;
    const url = new URL(req.url);

    switch (req.method) {
      case "GET":
        return handleGet(req, url, userId, supabase);
      case "PATCH":
        return handlePatch(req, userId, supabase);
      case "DELETE":
        return handleDelete(req, userId, supabase);
      default:
        return jsonResponse({ error: "Method not allowed. Use GET, PATCH, or DELETE." }, 405);
    }
  } catch (error) {
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
