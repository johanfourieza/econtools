import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStage as toStage, appendStageHistory } from "../_shared/pipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-kabbo-source",
};

// Simple hash function for API key validation
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Map common stage aliases; anything unrecognised lands in Idea.
function normalizeStage(stage: string): string {
  return toStage(stage) ?? "idea";
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
      target_journal,
      themes,
      grants,
      overleaf_url,
      github_repo,
      links,
    } = body;
    const source = req.headers.get("x-kabbo-source") === "mcp" ? "mcp" : "api";

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

    // Try to find existing publication by title (case-insensitive). maybeSingle
    // returns null (not an error) when there's no match – .single() would error
    // on the common zero-row case.
    const { data: existing } = await supabase
      .from("publications")
      .select("id, title, stage, stage_history, target_year")
      .eq("owner_id", userId)
      .ilike("title", title.trim())
      .limit(1)
      .maybeSingle();

    const now = new Date().toISOString();
    const pubData: Record<string, unknown> = { updated_at: now };

    // Only set fields that were provided
    if (authors !== undefined)
      pubData.authors = Array.isArray(authors) ? authors : [authors];
    if (normalizedStage) {
      pubData.stage = normalizedStage;
      // Upsert onto an existing row that changes stage: record the move the
      // same way the web client does, so analytics see it.
      if (existing && existing.stage !== normalizedStage) {
        pubData.stage_history = appendStageHistory(existing.stage_history, existing.stage, normalizedStage, now);
      }
    }
    if (notes !== undefined) pubData.notes = notes;
    if (output_type !== undefined) pubData.output_type = output_type;
    if (target_year !== undefined) pubData.target_year = target_year;
    if (target_journal !== undefined) pubData.target_journal = target_journal;
    if (themes !== undefined)
      pubData.themes = Array.isArray(themes) ? themes : [themes];
    if (grants !== undefined)
      pubData.grants = Array.isArray(grants) ? grants : [grants];
    if (overleaf_url !== undefined) pubData.overleaf_link = overleaf_url;
    if (github_repo !== undefined) pubData.github_repo = github_repo;
    // Links are stored as JSON strings client-side; stringify objects so they
    // don't round-trip back as "[object Object]".
    if (links !== undefined) {
      const arr = Array.isArray(links) ? links : [links];
      pubData.links = arr.map((l) => (typeof l === "string" ? l : JSON.stringify(l)));
    }

    // published-requires-year CHECK: never write a published row without a year.
    // Prefer an explicit year, then the existing row's year, then current year
    // (matches the web client). Only defaults when the year is truly absent, so
    // an update that leaves the year alone keeps it.
    const effectiveStage = (pubData.stage as string | undefined) ?? existing?.stage;
    if (
      effectiveStage === "published" &&
      (pubData.target_year === undefined || pubData.target_year === null)
    ) {
      pubData.target_year = existing?.target_year ?? new Date().getFullYear();
    }

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
      source,
      action,
      publication_id: resultId,
      publication_title: title.trim(),
      details: { stage: normalizedStage || existing?.stage || "idea" },
      kabbo_yaml_detected: false,
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
