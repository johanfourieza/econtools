import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
  };
  if (params && (method === "PATCH" || method === "POST")) {
    opts.body = JSON.stringify(params);
  }
  const res = await fetch(url.toString(), opts);
  return res.json();
}

const VALID_STAGES = ["idea", "draft", "submitted", "revise_resubmit", "resubmitted", "accepted", "published"];
const STAGE_ORDER: Record<string, number> = Object.fromEntries(VALID_STAGES.map((s, i) => [s, i]));

function createMcpServer(apiKey: string) {
  const server = new McpServer({ name: "kabbo", version: "2.0.0" });

  // --- Existing tools (1-6) ---

  server.tool({
    name: "list_publications",
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

  server.tool({
    name: "get_publication",
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

  server.tool({
    name: "create_publication",
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
        themes: { type: "array", items: { type: "string" }, description: "Research themes/topics" },
        grants: { type: "array", items: { type: "string" }, description: "Associated grants" },
        github_repo: { type: "string", description: "GitHub repository URL" },
        overleaf_url: { type: "string", description: "Overleaf project URL" },
      },
      required: ["title"],
    },
    handler: async (params: Record<string, unknown>) => {
      const url = `${SUPABASE_URL}/functions/v1/ingest-publications`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      return textResult(await res.json());
    },
  });

  server.tool({
    name: "update_publication",
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

  server.tool({
    name: "move_stage",
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

  server.tool({
    name: "delete_publication",
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

  // --- New tools (7-16) ---

  server.tool({
    name: "get_pipeline_summary",
    description: "Get an overview of your publication pipeline: counts by stage, recently updated papers, stalled papers (30+ days without movement), and total counts.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async () => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const { data: pubs } = await supabase
        .from("publications")
        .select("id, title, stage, updated_at, stage_history, target_year")
        .eq("owner_id", userId)
        .is("deleted_at", null);

      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      const stageCounts: Record<string, number> = {};
      VALID_STAGES.forEach(s => stageCounts[s] = 0);
      const stalled: { id: string; title: string; stage: string; days_stalled: number }[] = [];
      const recentlyUpdated: { id: string; title: string; stage: string; updated_at: string }[] = [];

      for (const p of pubs || []) {
        stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;
        const updatedMs = new Date(p.updated_at).getTime();
        const daysSince = Math.floor((now - updatedMs) / (24 * 60 * 60 * 1000));
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

  server.tool({
    name: "search_publications",
    description: "Search publications across title, authors, notes, and themes. More powerful than list_publications — supports multi-field filtering.",
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
      let q = supabase
        .from("publications")
        .select("id, title, authors, stage, notes, themes, grants, target_year, output_type, updated_at")
        .eq("owner_id", userId)
        .is("deleted_at", null);

      if (params.stage) q = q.eq("stage", String(params.stage));
      if (params.year) q = q.eq("target_year", Number(params.year));
      if (params.query) q = q.or(`title.ilike.%${params.query}%,notes.ilike.%${params.query}%`);
      if (params.author) q = q.contains("authors", [String(params.author)]);
      if (params.theme) q = q.contains("themes", [String(params.theme)]);
      if (params.grant) q = q.contains("grants", [String(params.grant)]);

      const limit = Math.min(Number(params.limit) || 50, 200);
      q = q.order("updated_at", { ascending: false }).limit(limit);

      const { data, error } = await q;
      if (error) throw error;
      return textResult({ count: (data || []).length, publications: data });
    },
  });

  server.tool({
    name: "bulk_update",
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
              stage: { type: "string" },
              notes: { type: "string" },
              themes: { type: "array", items: { type: "string" } },
              grants: { type: "array", items: { type: "string" } },
              target_year: { type: "number" },
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

  server.tool({
    name: "get_activity_log",
    description: "Get recent activity across all sources (web, API, MCP, webhook). Filter by date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back (default 7)" },
        source: { type: "string", description: "Filter by source: web, api, mcp, webhook" },
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

  server.tool({
    name: "manage_reminders",
    description: "Create, list, update, or delete reminders for publications. Use action: 'list', 'create', 'complete', or 'delete'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: { type: "string", description: "Action: list, create, complete, delete" },
        publication_id: { type: "string", description: "Publication UUID (required for create)" },
        reminder_id: { type: "string", description: "Reminder UUID (required for complete/delete)" },
        title: { type: "string", description: "Reminder title (for create)" },
        due_date: { type: "string", description: "Due date in ISO format (for create)" },
        reminder_type: { type: "string", description: "Type: conference_deadline, resubmission, review_response, grant_report, custom" },
      },
      required: ["action"],
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const action = String(params.action);

      if (action === "list") {
        const { data, error } = await supabase
          .from("reminders")
          .select("*")
          .eq("user_id", userId)
          .order("due_date", { ascending: true });
        if (error) throw error;
        return textResult({ count: (data || []).length, reminders: data });
      }

      if (action === "create") {
        const { data, error } = await supabase
          .from("reminders")
          .insert({
            user_id: userId,
            publication_id: params.publication_id || null,
            title: String(params.title || "Reminder"),
            due_date: params.due_date ? String(params.due_date) : null,
            reminder_type: String(params.reminder_type || "custom"),
          })
          .select()
          .single();
        if (error) throw error;
        return textResult({ action: "created", reminder: data });
      }

      if (action === "complete") {
        const { error } = await supabase
          .from("reminders")
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq("id", String(params.reminder_id))
          .eq("user_id", userId);
        if (error) throw error;
        return textResult({ action: "completed", reminder_id: params.reminder_id });
      }

      if (action === "delete") {
        const { error } = await supabase
          .from("reminders")
          .delete()
          .eq("id", String(params.reminder_id))
          .eq("user_id", userId);
        if (error) throw error;
        return textResult({ action: "deleted", reminder_id: params.reminder_id });
      }

      return textResult({ error: "Unknown action. Use: list, create, complete, delete" });
    },
  });

  server.tool({
    name: "get_analytics",
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
        .eq("owner_id", userId)
        .is("deleted_at", null);

      const all = pubs || [];
      const currentYear = new Date().getFullYear();

      const publishedByYear: Record<number, number> = {};
      const stageTimesMs: Record<string, number[]> = {};

      for (const p of all) {
        if (p.stage === "published" && p.target_year) {
          publishedByYear[p.target_year] = (publishedByYear[p.target_year] || 0) + 1;
        }
        const history = (p.stage_history || []) as Array<{ from: string; to: string; at: string }>;
        for (let i = 0; i < history.length; i++) {
          const entry = history[i];
          const nextAt = history[i + 1]?.at || p.updated_at;
          const durationMs = new Date(nextAt).getTime() - new Date(entry.at).getTime();
          if (!stageTimesMs[entry.to]) stageTimesMs[entry.to] = [];
          stageTimesMs[entry.to].push(durationMs);
        }
      }

      const avgDaysPerStage: Record<string, number> = {};
      for (const [stage, times] of Object.entries(stageTimesMs)) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        avgDaysPerStage[stage] = Math.round(avg / (24 * 60 * 60 * 1000));
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
        for (const p of all) {
          for (const a of (p.authors || [])) { byAuthor[a] = (byAuthor[a] || 0) + 1; }
        }
        result.by_author = byAuthor;
      } else if (params.breakdown_by === "theme") {
        const byTheme: Record<string, number> = {};
        for (const p of all) {
          for (const t of (p.themes || [])) { byTheme[t] = (byTheme[t] || 0) + 1; }
        }
        result.by_theme = byTheme;
      } else if (params.breakdown_by === "grant") {
        const byGrant: Record<string, number> = {};
        for (const p of all) {
          for (const g of (p.grants || [])) { byGrant[g] = (byGrant[g] || 0) + 1; }
        }
        result.by_grant = byGrant;
      } else if (params.breakdown_by === "output_type") {
        const byType: Record<string, number> = {};
        for (const p of all) {
          const t = p.output_type || "unspecified";
          byType[t] = (byType[t] || 0) + 1;
        }
        result.by_output_type = byType;
      }

      return textResult(result);
    },
  });

  server.tool({
    name: "get_team_summary",
    description: "Get a summary of a team's publication pipeline: member count, total papers, papers by stage per member, and stalled papers. Requires team admin access.",
    inputSchema: {
      type: "object" as const,
      properties: {
        team_id: { type: "string", description: "Team UUID" },
      },
      required: ["team_id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const { userId, supabase } = await getAuthenticatedUser(apiKey);
      const teamId = String(params.team_id);

      const { data: membership } = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .eq("status", "accepted")
        .single();

      if (!membership) return textResult({ error: "You are not a member of this team" });

      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, role, profiles(display_name)")
        .eq("team_id", teamId)
        .eq("status", "accepted");

      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const memberSummaries = [];

      for (const m of members || []) {
        if (!m.user_id) continue;
        const { data: pubs } = await supabase
          .from("publications")
          .select("id, title, stage, updated_at")
          .eq("owner_id", m.user_id)
          .is("deleted_at", null);

        const stageCounts: Record<string, number> = {};
        const stalledPapers: string[] = [];
        for (const p of pubs || []) {
          stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;
          const daysSince = Math.floor((now - new Date(p.updated_at).getTime()) / (24 * 60 * 60 * 1000));
          if (daysSince >= 30 && p.stage !== "published") stalledPapers.push(p.title);
        }

        memberSummaries.push({
          user_id: m.user_id,
          name: (m.profiles as any)?.display_name || "Unknown",
          role: m.role,
          total_papers: (pubs || []).length,
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

  server.tool({
    name: "export_bibtex",
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
        .select("id, title, authors, stage, target_year, output_type, notes")
        .eq("owner_id", userId)
        .is("deleted_at", null);

      if (params.stage) q = q.eq("stage", String(params.stage));
      if (params.year) q = q.eq("target_year", Number(params.year));
      if (params.ids) q = q.in("id", params.ids as string[]);

      const { data, error } = await q;
      if (error) throw error;

      const entries = (data || []).map((p) => {
        const key = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
        const authorStr = (p.authors || []).join(" and ");
        const type = p.output_type === "book" ? "book" : p.output_type === "chapter" ? "incollection" : "article";
        return `@${type}{${key},\n  title = {${p.title}},\n  author = {${authorStr}},\n  year = {${p.target_year || ""}},\n}`;
      });

      return textResult({ count: entries.length, bibtex: entries.join("\n\n") });
    },
  });

  server.tool({
    name: "add_note",
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
        .from("publications")
        .select("notes")
        .eq("id", String(params.id))
        .eq("owner_id", userId)
        .single();

      if (!pub) return textResult({ error: "Publication not found" });

      const timestamp = new Date().toISOString().slice(0, 10);
      const existing = pub.notes || "";
      const separator = existing ? "\n\n" : "";
      const updated = `${existing}${separator}[${timestamp}] ${params.note}`;

      const { error } = await supabase
        .from("publications")
        .update({ notes: updated, updated_at: new Date().toISOString() })
        .eq("id", String(params.id));

      if (error) throw error;
      return textResult({ success: true, publication_id: params.id, notes: updated });
    },
  });

  server.tool({
    name: "get_stalled_papers",
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
        .from("publications")
        .select("id, title, stage, authors, updated_at, target_year")
        .eq("owner_id", userId)
        .is("deleted_at", null)
        .neq("stage", "published")
        .lt("updated_at", cutoff)
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

  return server;
}

const app = new Hono();
const transport = new StreamableHttpTransport();

function getApiKey(req: Request): string | null {
  const url = new URL(req.url);
  return url.searchParams.get("api_key") || req.headers.get("x-api-key") || null;
}

app.all("/*", async (c) => {
  const apiKey = getApiKey(c.req.raw);
  if (!apiKey) {
    return c.json({ error: "Missing API key. Pass as ?api_key=YOUR_KEY query param or x-api-key header." }, 401);
  }
  const server = createMcpServer(apiKey);
  return await transport.handleRequest(c.req.raw, server);
});

Deno.serve(app.fetch);
