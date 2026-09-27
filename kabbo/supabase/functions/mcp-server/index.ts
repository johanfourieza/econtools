import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  VALID_STAGES,
  REMINDER_TYPES,
  normalizeReminderType,
  isStageVisible,
  parseBibtex,
  daysPerStage,
} from "../_shared/pipeline.ts";
import { computeToday } from "../_shared/today.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getAuthenticatedUser(apiKey: string): Promise<{ userId: string; supabase: SupabaseClient }> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const keyHash = await hashKey(apiKey);
  const { data: userId, error } = await supabase.rpc("validate_api_key", { _key_hash: keyHash });
  if (error || !userId) throw new Error("Invalid API key");
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", keyHash);
  return { userId, supabase };
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// Tools that write to Postgres directly (rather than through api-publications)
// record what they did here, so the Activity tab and get_activity_log show
// agent edits alongside web and API ones. Never throws: logging must not fail
// the tool call.
async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  publication: { id?: string | null; title?: string | null } | null,
  details: Record<string, unknown> = {},
) {
  try {
    await supabase.from("activity_log").insert({
      user_id: userId,
      source: "mcp",
      action,
      publication_id: publication?.id ?? null,
      publication_title: publication?.title ?? null,
      details,
      kabbo_yaml_detected: false,
    });
  } catch (e) {
    console.error("activity_log insert failed:", e);
  }
}

// Requests the MCP server makes to the REST edge functions carry this header so
// their activity_log rows are attributed to the agent, not to a raw API client.
const PROXY_HEADERS = { "Content-Type": "application/json", "x-kabbo-source": "mcp" };

async function callApi(
  method: string,
  apiKey: string,
  params?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/api-publications`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const opts: RequestInit = {
    method,
    headers: { "x-api-key": apiKey, ...PROXY_HEADERS },
  };
  if (params && (method === "PATCH" || method === "POST")) {
    opts.body = JSON.stringify(params);
  }
  const res = await fetch(url.toString(), opts);
  return res.json();
}

function createMcpServer(apiKey: string) {
  const server = new McpServer({ name: "kabbo", version: "2.2.0" });

  // ===========================================================================
  // Tools 1-6 — Core CRUD
  // ===========================================================================

  server.tool("list_publications", {
    description: "List all publications in the pipeline. Optionally filter by search query or stage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search publications by title (partial match)" },
        stage: { type: "string", description: "Filter by stage: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published" },
        limit: { type: "number", description: "Max results to return (default 100, max 500)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const q: Record<string, string> = {};
      if (params.query) q.q = String(params.query);
      if (params.stage) q.stage = String(params.stage);
      if (params.limit) q.limit = String(params.limit);
      if (params.offset) q.offset = String(params.offset);
      return textResult(await callApi("GET", apiKey, undefined, q));
    },
  });

  server.tool("get_publication", {
    description: "Get a single publication by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Publication UUID" } },
      required: ["id"],
    },
    handler: async (params: Record<string, unknown>) => {
      return textResult(await callApi("GET", apiKey, undefined, { id: String(params.id) }));
    },
  });

  server.tool("create_publication", {
    description: "Create a new publication in the pipeline. Title is required. Stage defaults to 'idea'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Publication title (required)" },
        authors: { type: "array", items: { type: "string" }, description: "List of author names" },
        stage: { type: "string", description: "Pipeline stage: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published" },
        notes: { type: "string", description: "Notes about the publication" },
        output_type: { type: "string", description: "Output type: journal, book, chapter" },
        target_year: { type: "number", description: "Target completion year" },
        target_journal: { type: "string", description: "Intended journal" },
        themes: { type: "array", items: { type: "string" }, description: "Research themes/topics" },
        grants: { type: "array", items: { type: "string" }, description: "Associated grants" },
        github_repo: { type: "string", description: "GitHub repository URL" },
        overleaf_url: { type: "string", description: "Overleaf project URL" },
      },
      required: ["title"],
    },
    handler: async (params: Record<string, unknown>) => {
      const url = `${SUPABASE_URL}/functions/v1/ingest-publication`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-api-key": apiKey, ...PROXY_HEADERS },
        body: JSON.stringify(params),
      });
      return textResult(await res.json());
    },
  });

  server.tool("update_publication", {
    description: "Update an existing publication. Provide the ID and any fields to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID (required)" },
        title: { type: "string", description: "New title" },
        authors: { type: "array", items: { type: "string" }, description: "Updated author list" },
        stage: { type: "string", description: "New pipeline stage" },
        notes: { type: "string", description: "Updated notes" },
        output_type: { type: "string", description: "Output type" },
        target_year: { type: "number", description: "Target year" },
        target_journal: { type: "string", description: "Intended journal" },
        themes: { type: "array", items: { type: "string" }, description: "Updated themes" },
        grants: { type: "array", items: { type: "string" }, description: "Updated grants" },
        github_repo: { type: "string", description: "GitHub repo URL" },
        overleaf_url: { type: "string", description: "Overleaf URL" },
      },
      required: ["id"],
    },
    handler: async (params: Record<string, unknown>) => {
      return textResult(await callApi("PATCH", apiKey, params));
    },
  });

  server.tool("move_stage", {
    description: "Move a publication to a different pipeline stage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
        stage: { type: "string", description: "Target stage: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published" },
      },
      required: ["id", "stage"],
    },
    handler: async (params: Record<string, unknown>) => {
      return textResult(await callApi("PATCH", apiKey, { id: params.id, stage: params.stage }));
    },
  });

  server.tool("delete_publication", {
    description: "Move a publication to the bin (soft delete). Can be restored from the Kabbo UI.",
    inputSchema: {
      type: "object" as const,
      properties: { id: { type: "string", description: "Publication UUID to delete" } },
      required: ["id"],
    },
    handler: async (params: Record<string, unknown>) => {
      return textResult(await callApi("DELETE", apiKey, undefined, { id: String(params.id) }));
    },
  });

  // ===========================================================================
  // Tools 7-16 — Analytics, search, reminders, team, export, notes
  // ===========================================================================

  server.tool("get_pipeline_summary", {
    description: "Get an overview of your publication pipeline: counts by stage, recently updated papers, stalled papers (30+ days without movement), and total counts.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data: pubs } = await supabase
        .from("publications")
        .select("id, title, stage, updated_at, stage_history, target_year")
        .eq("owner_id", userId);

      const now = Date.now();
      const stageCounts: Record<string, number> = {};
      VALID_STAGES.forEach(s => stageCounts[s] = 0);
      const stalled: { id: string; title: string; stage: string; days_stalled: number }[] = [];
      const recentlyUpdated: { id: string; title: string; stage: string; updated_at: string }[] = [];

      for (const p of pubs || []) {
        stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;
        const daysSince = Math.floor((now - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000));
        if (daysSince >= 30 && p.stage !== "published") {
          stalled.push({ id: p.id, title: p.title, stage: p.stage, days_stalled: daysSince });
        }
        if (daysSince <= 7) {
          recentlyUpdated.push({ id: p.id, title: p.title, stage: p.stage, updated_at: p.updated_at });
        }
      }

      stalled.sort((a, b) => b.days_stalled - a.days_stalled);
      recentlyUpdated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      return textResult({
        total: (pubs || []).length,
        by_stage: stageCounts,
        stalled: stalled.slice(0, 10),
        recently_updated: recentlyUpdated.slice(0, 10),
      });
    },
  });

  server.tool("search_publications", {
    description: "Search publications across title, authors, notes, and themes. More powerful than list_publications – supports multi-field filtering.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search text (matches title, notes, authors, themes)" },
        stage: { type: "string", description: "Filter by stage" },
        author: { type: "string", description: "Filter by author name (partial match)" },
        theme: { type: "string", description: "Filter by theme (partial match)" },
        grant: { type: "string", description: "Filter by grant (partial match)" },
        year: { type: "number", description: "Filter by target year" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const limit = Math.min(Number(params.limit) || 50, 200);

      // author/theme/grant are text[] columns; PostgREST `.contains` only does
      // exact element matches, but the tool advertises *partial* matching (so
      // "Fourie" should find "Johan Fourie"). Filter those in JS instead. When
      // we do, fetch a wider window first and slice afterwards so we don't cap
      // results before filtering.
      const needsPostFilter = !!(params.author || params.theme || params.grant);

      let q = supabase
        .from("publications")
        .select("id, title, authors, stage, notes, themes, grants, target_year, output_type, updated_at")
        .eq("owner_id", userId);

      if (params.stage) q = q.eq("stage", String(params.stage));
      if (params.year) q = q.eq("target_year", Number(params.year));
      if (params.query) q = q.or(`title.ilike.%${params.query}%,notes.ilike.%${params.query}%`);

      q = q.order("updated_at", { ascending: false }).limit(needsPostFilter ? 1000 : limit);

      const { data, error } = await q;
      if (error) throw error;

      let rows = data || [];
      const matchArr = (arr: unknown, needle: string) =>
        Array.isArray(arr) &&
        arr.some((v) => String(v).toLowerCase().includes(needle.toLowerCase()));
      if (params.author) rows = rows.filter((r) => matchArr(r.authors, String(params.author)));
      if (params.theme) rows = rows.filter((r) => matchArr(r.themes, String(params.theme)));
      if (params.grant) rows = rows.filter((r) => matchArr(r.grants, String(params.grant)));
      if (needsPostFilter) rows = rows.slice(0, limit);

      return textResult({ count: rows.length, publications: rows });
    },
  });

  server.tool("bulk_update", {
    description: "Update multiple publications at once. Provide an array of {id, ...updates} objects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Publication UUID" },
              title: { type: "string" },
              authors: { type: "array", items: { type: "string" } },
              stage: { type: "string" },
              notes: { type: "string" },
              themes: { type: "array", items: { type: "string" } },
              grants: { type: "array", items: { type: "string" } },
              target_year: { type: "number" },
              target_journal: { type: "string" },
            },
            required: ["id"],
          },
          description: "Array of updates, each with an id and fields to change",
        },
      },
      required: ["updates"],
    },
    handler: async (params: Record<string, unknown>) => {
      const updates = params.updates as Array<Record<string, unknown>>;
      const results = [];
      for (const u of updates) {
        const result = await callApi("PATCH", apiKey, u);
        results.push({ id: u.id, result });
      }
      return textResult({ updated: results.length, results });
    },
  });

  server.tool("get_activity_log", {
    description: "Get recent activity across all sources (web, api, mcp). Filter by date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back (default 7)" },
        source: { type: "string", description: "Filter by source: web, api, mcp" },
        limit: { type: "number", description: "Max entries (default 50)" },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const days = Number(params.days) || 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const limit = Math.min(Number(params.limit) || 50, 200);

      let q = supabase
        .from("activity_log")
        .select("id, action, source, publication_title, details, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (params.source) q = q.eq("source", String(params.source));

      const { data, error } = await q;
      if (error) throw error;
      return textResult({ period: `last ${days} days`, count: (data || []).length, entries: data });
    },
  });

  server.tool("manage_reminders", {
    description: `List, create, complete, or delete reminders. Use action: 'list' (open reminders, soonest first; pass include_completed for all), 'create' (title and due_date required), 'complete', or 'delete'. Types: ${REMINDER_TYPES.join(", ")}.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string", description: "Action: list, create, complete, delete" },
        publication_id: { type: "string", description: "Publication UUID to attach the reminder to (optional for create)" },
        reminder_id: { type: "string", description: "Reminder UUID (required for complete/delete)" },
        title: { type: "string", description: "Reminder title (required for create)" },
        description: { type: "string", description: "Optional longer note (for create)" },
        due_date: { type: "string", description: "Due date, ISO 8601 (required for create)" },
        reminder_type: { type: "string", description: `One of: ${REMINDER_TYPES.join(", ")} (default general)` },
        include_completed: { type: "boolean", description: "For list: include completed reminders (default false)" },
      },
      required: ["action"],
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const action = String(params.action);

      if (action === "list") {
        let q = supabase
          .from("reminders")
          .select("id, publication_id, title, description, due_date, reminder_type, is_completed, created_at")
          .eq("user_id", userId)
          .order("due_date", { ascending: true });
        if (!params.include_completed) q = q.eq("is_completed", false);
        const { data, error } = await q;
        if (error) throw error;
        return textResult({ count: (data || []).length, reminders: data });
      }

      if (action === "create") {
        const title = String(params.title || "").trim();
        const dueRaw = params.due_date ? String(params.due_date) : "";
        const due = dueRaw ? new Date(dueRaw) : null;
        if (!title) return textResult({ error: "title is required for create" });
        if (!due || Number.isNaN(due.getTime())) {
          return textResult({ error: "due_date is required for create and must be an ISO 8601 date, e.g. 2026-06-15" });
        }
        // Only attach to a publication the caller owns; otherwise create it unattached.
        let publicationId: string | null = null;
        let pubTitle: string | null = null;
        if (params.publication_id) {
          const { data: pub } = await supabase
            .from("publications").select("id, title")
            .eq("id", String(params.publication_id)).eq("owner_id", userId).maybeSingle();
          if (!pub) return textResult({ error: "Publication not found" });
          publicationId = pub.id;
          pubTitle = pub.title;
        }
        const reminderType = normalizeReminderType(params.reminder_type as string | undefined);
        const { data, error } = await supabase
          .from("reminders")
          .insert({
            user_id: userId,
            publication_id: publicationId,
            title,
            description: params.description ? String(params.description) : null,
            due_date: due.toISOString(),
            reminder_type: reminderType,
          })
          .select("id, publication_id, title, description, due_date, reminder_type, is_completed")
          .single();
        if (error) throw error;
        await logActivity(supabase, userId, "reminder_created", { id: publicationId, title: pubTitle },
          { reminder_id: data.id, title, due_date: data.due_date, reminder_type: reminderType });
        return textResult({ action: "created", reminder: data });
      }

      if (action === "complete" || action === "delete") {
        const reminderId = String(params.reminder_id || "");
        if (!reminderId) return textResult({ error: `reminder_id is required for ${action}` });
        const { data: existing } = await supabase
          .from("reminders").select("id, title, publication_id")
          .eq("id", reminderId).eq("user_id", userId).maybeSingle();
        if (!existing) return textResult({ error: "Reminder not found" });

        const { error } = action === "complete"
          ? await supabase.from("reminders").update({ is_completed: true }).eq("id", reminderId)
          : await supabase.from("reminders").delete().eq("id", reminderId);
        if (error) throw error;
        await logActivity(supabase, userId, `reminder_${action === "complete" ? "completed" : "deleted"}`,
          { id: existing.publication_id }, { reminder_id: reminderId, title: existing.title });
        return textResult({ action: action === "complete" ? "completed" : "deleted", reminder_id: reminderId });
      }

      return textResult({ error: "Unknown action. Use: list, create, complete, delete" });
    },
  });

  server.tool("get_analytics", {
    description: "Get analytics about your publication pipeline: conversion rates between stages, average time per stage, publication velocity by year, and breakdowns by author/theme/grant.",
    inputSchema: {
      type: "object" as const,
      properties: {
        breakdown_by: { type: "string", description: "Optional: 'author', 'theme', 'grant', 'year', or 'output_type'" },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data: pubs } = await supabase
        .from("publications")
        .select("id, title, stage, authors, themes, grants, output_type, target_year, stage_history, created_at, updated_at")
        .eq("owner_id", userId);

      const all = pubs || [];
      const currentYear = new Date().getFullYear();
      const publishedByYear: Record<number, number> = {};
      const stageDays: Record<string, number[]> = {};
      const now = Date.now();

      for (const p of all) {
        if (p.stage === "published" && p.target_year) {
          publishedByYear[p.target_year] = (publishedByYear[p.target_year] || 0) + 1;
        }
        // A paper still sitting in a stage has been there until today, not
        // until the row was last edited.
        for (const [stage, days] of Object.entries(daysPerStage(p.stage_history, now))) {
          (stageDays[stage] ??= []).push(...days);
        }
      }

      const avgDaysPerStage: Record<string, number> = {};
      for (const [stage, days] of Object.entries(stageDays)) {
        avgDaysPerStage[stage] = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      }

      const result: Record<string, unknown> = {
        total_publications: all.length,
        published_by_year: publishedByYear,
        avg_days_per_stage: avgDaysPerStage,
        current_year_published: publishedByYear[currentYear] || 0,
        previous_year_published: publishedByYear[currentYear - 1] || 0,
      };

      if (params.breakdown_by === "author") {
        const byAuthor: Record<string, number> = {};
        for (const p of all) for (const a of (p.authors || [])) byAuthor[a] = (byAuthor[a] || 0) + 1;
        result.by_author = byAuthor;
      } else if (params.breakdown_by === "theme") {
        const byTheme: Record<string, number> = {};
        for (const p of all) for (const t of (p.themes || [])) byTheme[t] = (byTheme[t] || 0) + 1;
        result.by_theme = byTheme;
      } else if (params.breakdown_by === "grant") {
        const byGrant: Record<string, number> = {};
        for (const p of all) for (const g of (p.grants || [])) byGrant[g] = (byGrant[g] || 0) + 1;
        result.by_grant = byGrant;
      } else if (params.breakdown_by === "output_type") {
        const byType: Record<string, number> = {};
        for (const p of all) { const t = p.output_type || "unspecified"; byType[t] = (byType[t] || 0) + 1; }
        result.by_output_type = byType;
      }

      return textResult(result);
    },
  });

  server.tool("get_team_summary", {
    description: "Get a summary of a team's publication pipeline: member count, total papers, papers by stage per member, and stalled papers. Requires team dashboard access (team creator, admin, explicit dashboard access, or a team whose dashboard is public). Each member's papers are filtered by the stage floor that member chose for the team.",
    inputSchema: {
      type: "object" as const,
      properties: { team_id: { type: "string", description: "Team UUID" } },
      required: ["team_id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const teamId = String(params.team_id);

      // Mirror public.has_dashboard_access() and the TeamsModal check: the
      // service-role client bypasses RLS, so the rules are applied here.
      const [{ data: membership }, { data: team }] = await Promise.all([
        supabase
          .from("team_members").select("role, has_dashboard_access")
          .eq("team_id", teamId).eq("user_id", userId).eq("status", "accepted").maybeSingle(),
        supabase.from("teams").select("id, created_by, dashboard_public").eq("id", teamId).maybeSingle(),
      ]);
      if (!team || !membership) return textResult({ error: "You are not a member of this team" });
      const hasDashboardAccess =
        team.created_by === userId ||
        membership.role === "admin" ||
        membership.has_dashboard_access === true ||
        team.dashboard_public === true;
      if (!hasDashboardAccess) {
        return textResult({ error: "You do not have dashboard access for this team. Ask the team admin to grant it." });
      }

      const [{ data: members }, { data: visibility }] = await Promise.all([
        supabase
          .from("team_members").select("user_id, role, profiles(display_name)")
          .eq("team_id", teamId).eq("status", "accepted"),
        supabase.from("visibility_settings").select("user_id, min_visible_stage").eq("team_id", teamId),
      ]);
      const minStageByUser = new Map<string, string>();
      for (const v of visibility || []) minStageByUser.set(v.user_id, String(v.min_visible_stage));

      const now = Date.now();
      const memberSummaries = [];
      for (const m of members || []) {
        if (!m.user_id) continue;
        const { data: allPubs } = await supabase
          .from("publications").select("id, title, stage, updated_at")
          .eq("owner_id", m.user_id);
        // Your own papers are always fully visible to you; a teammate's are
        // cut at the floor they set (visibility_settings.min_visible_stage).
        const minStage = m.user_id === userId ? "idea" : (minStageByUser.get(m.user_id) ?? "idea");
        const pubs = (allPubs || []).filter((p) => isStageVisible(p.stage, minStage));

        const stageCounts: Record<string, number> = {};
        const stalledPapers: string[] = [];
        for (const p of pubs) {
          stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;
          const daysSince = Math.floor((now - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000));
          if (daysSince >= 30 && p.stage !== "published") stalledPapers.push(p.title);
        }
        memberSummaries.push({
          user_id: m.user_id,
          name: (m.profiles as { display_name?: string } | null)?.display_name || "Unknown",
          role: m.role,
          visible_from_stage: minStage,
          total_papers: pubs.length,
          by_stage: stageCounts,
          stalled_count: stalledPapers.length,
          stalled_papers: stalledPapers.slice(0, 5),
        });
      }

      return textResult({
        team_id: teamId,
        member_count: memberSummaries.length,
        total_papers: memberSummaries.reduce((s, m) => s + m.total_papers, 0),
        members: memberSummaries,
      });
    },
  });

  server.tool("get_today", {
    description: "What needs your attention today: overdue and due-soon reminders, revisions waiting on you, submissions with no decision after about four months, accepted papers to check on, long-idle drafts, and published papers missing a year. Ideas and papers under review inside the normal window are never listed. This is the same list the Kabbo dashboard shows under Today. Read-only.",
    inputSchema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "Max items to return (default 10, max 50)" } },
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const [{ data: pubs }, { data: rems }] = await Promise.all([
        supabase
          .from("publications").select("id, title, stage, updated_at, stage_history, target_year")
          .eq("owner_id", userId),
        supabase
          .from("reminders").select("id, publication_id, title, due_date, is_completed")
          .eq("user_id", userId).eq("is_completed", false),
      ]);
      const items = computeToday(
        (pubs || []).map((p) => ({
          id: p.id, title: p.title, stage: p.stage, updatedAt: p.updated_at, history: p.stage_history,
          missingYear: p.stage === "published" && p.target_year == null,
        })),
        (rems || []).map((r) => ({
          id: r.id, publicationId: r.publication_id, title: r.title, dueDate: r.due_date, isCompleted: r.is_completed,
        })),
      );
      const limit = Math.min(Number(params.limit) || 10, 50);
      return textResult({ count: items.length, items: items.slice(0, limit) });
    },
  });

  server.tool("export_bibtex", {
    description: "Generate BibTeX entries for your publications. Filter by stage, year, or specific IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        stage: { type: "string", description: "Filter by stage (e.g. 'published')" },
        year: { type: "number", description: "Filter by target year" },
        ids: { type: "array", items: { type: "string" }, description: "Specific publication UUIDs" },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      let q = supabase
        .from("publications")
        .select("id, title, authors, stage, target_year, target_journal, output_type, notes")
        .eq("owner_id", userId);

      if (params.stage) q = q.eq("stage", String(params.stage));
      if (params.year) q = q.eq("target_year", Number(params.year));
      if (params.ids) q = q.in("id", params.ids as string[]);

      const { data, error } = await q;
      if (error) throw error;

      const entries = (data || []).map((p) => {
        const key = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
        const authorStr = (p.authors || []).join(" and ");
        const type = p.output_type === "book" ? "book" : p.output_type === "chapter" ? "incollection" : "article";
        const journalLine = p.target_journal ? `\n  journal = {${p.target_journal}},` : "";
        return `@${type}{${key},\n  title = {${p.title}},\n  author = {${authorStr}},\n  year = {${p.target_year || ""}},${journalLine}\n}`;
      });

      return textResult({ count: entries.length, bibtex: entries.join("\n\n") });
    },
  });

  server.tool("add_note", {
    description: "Append a note to a publication's existing notes without overwriting them.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
        note: { type: "string", description: "Note text to append" },
      },
      required: ["id", "note"],
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data: pub } = await supabase
        .from("publications").select("id, title, notes").eq("id", String(params.id)).eq("owner_id", userId).maybeSingle();
      if (!pub) return textResult({ error: "Publication not found" });

      const timestamp = new Date().toISOString().slice(0, 10);
      const existing = pub.notes || "";
      const separator = existing ? "\n\n" : "";
      const updated = `${existing}${separator}[${timestamp}] ${params.note}`;

      const { error } = await supabase
        .from("publications").update({ notes: updated, updated_at: new Date().toISOString() })
        .eq("id", pub.id);
      if (error) throw error;
      await logActivity(supabase, userId, "note_added", pub, { note: String(params.note).slice(0, 200) });
      return textResult({ success: true, publication_id: pub.id, notes: updated });
    },
  });

  server.tool("get_stalled_papers", {
    description: "Get publications that haven't been updated in a while. Useful for identifying papers that need attention.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Minimum days since last update (default 30)" },
        stage: { type: "string", description: "Filter by stage" },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const minDays = Number(params.days) || 30;
      const cutoff = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000).toISOString();

      let q = supabase
        .from("publications").select("id, title, stage, authors, updated_at, target_year")
        .eq("owner_id", userId)        .neq("stage", "published").lt("updated_at", cutoff)
        .order("updated_at", { ascending: true });
      if (params.stage) q = q.eq("stage", String(params.stage));

      const { data, error } = await q;
      if (error) throw error;
      const now = Date.now();
      const results = (data || []).map(p => ({
        ...p,
        days_stalled: Math.floor((now - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000)),
      }));
      return textResult({ count: results.length, threshold_days: minDays, stalled: results });
    },
  });

  // ===========================================================================
  // Tools — Workflow & metadata
  // ===========================================================================

  server.tool("link_repo", {
    description: "Attach a GitHub repository URL and/or Overleaf project URL to a publication as metadata (e.g. where the data or paper source lives).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
        github_repo: { type: "string", description: "GitHub repository URL" },
        overleaf_url: { type: "string", description: "Overleaf project URL" },
      },
      required: ["id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data: pub } = await supabase
        .from("publications").select("id, title").eq("id", String(params.id)).eq("owner_id", userId).maybeSingle();
      if (!pub) return textResult({ error: "Publication not found" });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.github_repo) patch.github_repo = String(params.github_repo);
      if (params.overleaf_url) patch.overleaf_link = String(params.overleaf_url);
      const { error } = await supabase.from("publications").update(patch).eq("id", pub.id);
      if (error) throw error;
      const { updated_at: _u, ...linked } = patch;
      await logActivity(supabase, userId, "updated", pub, { fields: Object.keys(linked) });
      return textResult({ success: true, publication_id: pub.id, linked });
    },
  });

  server.tool("set_target_journal", {
    description: "Set the intended journal for a publication.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
        journal: { type: "string", description: "Target journal name" },
      },
      required: ["id", "journal"],
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data: pub } = await supabase
        .from("publications").select("id, title").eq("id", String(params.id)).eq("owner_id", userId).maybeSingle();
      if (!pub) return textResult({ error: "Publication not found" });
      const { error } = await supabase
        .from("publications")
        .update({ target_journal: String(params.journal), updated_at: new Date().toISOString() })
        .eq("id", pub.id);
      if (error) throw error;
      await logActivity(supabase, userId, "updated", pub, { fields: ["target_journal"], target_journal: params.journal });
      return textResult({ success: true, publication_id: pub.id, target_journal: params.journal });
    },
  });

  server.tool("import_bibtex", {
    description: "Import publications from a BibTeX string. Each entry becomes a publication (upserted by title). Maps title, author, year, and journal.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bibtex: { type: "string", description: "Raw BibTeX text (one or more @entries)" },
        stage: { type: "string", description: "Stage to assign imported papers (default 'published')" },
      },
      required: ["bibtex"],
    },
    handler: async (params: Record<string, unknown>) => {
      const entries = parseBibtex(String(params.bibtex));
      const stage = String(params.stage || "published");
      const results = [];
      for (const e of entries) {
        if (!e.title) continue;
        const authors = e.author ? e.author.split(/\s+and\s+/).map((a) => a.trim()).filter(Boolean) : undefined;
        const body: Record<string, unknown> = { title: e.title, stage };
        if (authors) body.authors = authors;
        if (e.year && /^\d{4}$/.test(e.year)) body.target_year = Number(e.year);
        if (e.journal || e.journaltitle) body.target_journal = e.journal || e.journaltitle;
        if (e._type === "book") body.output_type = "book";
        else if (e._type === "incollection" || e._type === "inbook") body.output_type = "chapter";
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-publication`, {
          method: "POST",
          headers: { "x-api-key": apiKey, ...PROXY_HEADERS },
          body: JSON.stringify(body),
        });
        results.push({ title: e.title, result: await res.json() });
      }
      return textResult({ parsed: entries.length, imported: results.length, results });
    },
  });

  server.tool("manage_related_papers", {
    description: "List, add, or remove entries in a publication's related-papers list. Use action: 'list', 'add', 'remove'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
        action: { type: "string", description: "list, add, or remove" },
        value: { type: "string", description: "Related paper (title, DOI, or URL) for add/remove" },
      },
      required: ["id", "action"],
    },
    handler: async (params: Record<string, unknown>) => {
      return await manageStringArray(apiKey, "related_papers", params);
    },
  });

  server.tool("manage_data_sources", {
    description: "List, add, or remove entries in a publication's data-sources list. Use action: 'list', 'add', 'remove'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
        action: { type: "string", description: "list, add, or remove" },
        value: { type: "string", description: "Data source (name or URL) for add/remove" },
      },
      required: ["id", "action"],
    },
    handler: async (params: Record<string, unknown>) => {
      return await manageStringArray(apiKey, "data_sources", params);
    },
  });

  // ===========================================================================
  // Resources — read pipeline state as context without a tool round-trip
  // ===========================================================================

  server.resource(
    "kabbo://pipeline/summary",
    { name: "Pipeline summary", description: "Counts by stage, stalled and recently-updated papers", mimeType: "application/json" },
    async (uri: URL) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data: pubs } = await supabase
        .from("publications").select("id, title, stage, updated_at")
        .eq("owner_id", userId);
      const now = Date.now();
      const byStage: Record<string, number> = {};
      VALID_STAGES.forEach(s => byStage[s] = 0);
      const stalled = [];
      for (const p of pubs || []) {
        byStage[p.stage] = (byStage[p.stage] || 0) + 1;
        const days = Math.floor((now - new Date(p.updated_at).getTime()) / (864e5));
        if (days >= 30 && p.stage !== "published") stalled.push({ title: p.title, stage: p.stage, days });
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json",
        text: JSON.stringify({ total: (pubs || []).length, by_stage: byStage, stalled }, null, 2) }] };
    },
  );

  server.resource(
    "kabbo://publications",
    { name: "All publications", description: "Every publication with stage and metadata", mimeType: "application/json" },
    async (uri: URL) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data } = await supabase
        .from("publications")
        .select("id, title, stage, authors, themes, grants, target_year, target_journal, github_repo, overleaf_link, updated_at")
        .eq("owner_id", userId).order("updated_at", { ascending: false });
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.resource(
    "kabbo://publication/{id}",
    { name: "Publication", description: "A single publication by id", mimeType: "application/json" },
    async (uri: URL, params: { id: string }) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data } = await supabase
        .from("publications").select("*")
        .eq("id", params.id).eq("owner_id", userId).maybeSingle();
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.resource(
    "kabbo://activity/recent",
    { name: "Recent activity", description: "Activity log entries from the last 14 days", mimeType: "application/json" },
    async (uri: URL) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const { data } = await supabase
        .from("activity_log").select("action, source, publication_title, details, created_at")
        .eq("user_id", userId).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(100);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    },
  );

  // ===========================================================================
  // Prompts — appear as slash commands in Claude Code
  // ===========================================================================

  server.prompt("morning_checkin", {
    description: "A quick start-of-day overview of your pipeline and what needs attention.",
    handler: () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text:
        "Give me my Kabbo morning check-in. Call get_today first: that is the list of things that need me. Then call get_pipeline_summary for what moved recently. In 3-4 sentences tell me what needs me today, what moved this week, and the single most useful thing I could do. Read only: do not call any tool that writes." } }],
    }),
  });

  server.prompt("weekly_review", {
    description: "Summarise the past week's pipeline activity and progress.",
    handler: () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text:
        "Run my Kabbo weekly review. Call get_activity_log with days=7 and get_pipeline_summary. Summarise what changed, which papers advanced a stage, and flag anything stuck. End with 2-3 concrete suggestions for next week." } }],
    }),
  });

  server.prompt("annual_report", {
    description: "Draft an annual research-output summary for a given year.",
    arguments: [{ name: "year", description: "The year to report on (e.g. 2026)", required: false }],
    handler: (args: { year?: string }) => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text:
        `Draft my annual research-output summary${args?.year ? ` for ${args.year}` : ""}. Call get_analytics (and with breakdown_by='theme' and 'grant'), and export_bibtex for that year's published work. Produce a short narrative paragraph plus a bulleted list of outputs by stage, suitable for a faculty annual review.` } }],
    }),
  });

  server.prompt("submission_prep", {
    description: "Prepare a paper for submission: checklist and metadata review.",
    arguments: [{ name: "title", description: "Title (or part) of the paper to prepare", required: true }],
    handler: (args: { title?: string }) => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text:
        `Help me prepare "${args?.title ?? "my current paper"}" for submission. Use search_publications to find it, then check it has authors, a target_journal and themes; if a journal isn't set, ask me and use set_target_journal. Give me a short submission checklist (cover letter, data and code availability, formatting for the target journal, co-author sign-off). Do NOT call move_stage: preparing is not submitting. Only when I tell you the paper has actually been submitted, move it to 'submitted' and offer to set a reminder to check on the decision.` } }],
    }),
  });

  server.prompt("stalled_triage", {
    description: "Triage stalled papers and decide what to do with each.",
    handler: () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text:
        "Call get_stalled_papers (days=30). For each stalled paper, suggest one concrete next action (nudge co-author, withdraw and resubmit, mark published, archive). Keep it to one line each, ordered by how long they've been stuck." } }],
    }),
  });

  return server;
}

// Shared helper for manage_related_papers / manage_data_sources.
async function manageStringArray(
  apiKey: string, column: "related_papers" | "data_sources", params: Record<string, unknown>,
) {
  const { userId, supabase } = await getAuthenticatedUser(apiKey);
  const id = String(params.id);
  const action = String(params.action);
  const { data: pub } = await supabase
    .from("publications").select(`id, title, ${column}`).eq("id", id).eq("owner_id", userId).maybeSingle();
  if (!pub) return textResult({ error: "Publication not found" });

  const current: string[] = Array.isArray((pub as Record<string, unknown>)[column])
    ? ((pub as Record<string, unknown>)[column] as string[]) : [];

  if (action === "list") return textResult({ [column]: current });

  const value = String(params.value || "").trim();
  if (!value) return textResult({ error: "value is required for add/remove" });

  let next: string[];
  if (action === "add") next = current.includes(value) ? current : [...current, value];
  else if (action === "remove") next = current.filter((v) => v !== value);
  else return textResult({ error: "Unknown action. Use: list, add, remove" });

  const { error } = await supabase
    .from("publications").update({ [column]: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  await logActivity(supabase, userId, "updated", { id, title: (pub as { title?: string }).title },
    { fields: [column], action, value });
  return textResult({ success: true, [column]: next });
}

const app = new Hono();

function getApiKey(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("api_key") || req.headers.get("x-api-key") || null;
}

app.all("/*", async (c) => {
  const apiKey = getApiKey(c.req.raw);
  if (!apiKey) {
    return c.json({ error: "Missing API key. Pass as ?api_key=YOUR_KEY query param or x-api-key header." }, 401);
  }
  // mcp-lite 0.10.0: build a fresh server + transport per request (the server is
  // scoped to this API key, and transport.bind mutates transport state, so a
  // shared transport would race across concurrent requests). bind() returns the
  // HTTP handler; handleRequest is private.
  try {
    const server = createMcpServer(apiKey);
    const transport = new StreamableHttpTransport();
    const handler = transport.bind(server);
    return await handler(c.req.raw);
  } catch (e) {
    console.error("mcp-server error:", e);
    return c.json({ error: "Internal server error" }, 500);
  }
});

Deno.serve(app.fetch);
