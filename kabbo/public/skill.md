---
name: kabbo
description: Manage your academic publication pipeline via the Kabbo MCP server. List, search, create, update, and analyse publications. Track stalled papers, set reminders, export BibTeX, and review team progress.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
user-invocable: true
---

# Kabbo — Publication Pipeline Skill

Kabbo is an academic publication pipeline tracker at https://kabbo.app. This
skill connects to the Kabbo MCP server, which exposes 16 tools for managing
publications through seven stages: Idea, Draft, Submitted, Revise & Resubmit,
Resubmitted, Accepted, Published.

## MCP connection

The Kabbo MCP server should already be configured in your Claude Code settings.
If not, add this to `~/.claude/settings.json` (replace YOUR_API_KEY):

```json
{
  "mcpServers": {
    "kabbo": {
      "type": "url",
      "url": "https://jydnsbaztvmjkebhmoia.supabase.co/functions/v1/mcp-server?api_key=YOUR_API_KEY"
    }
  }
}
```

Generate an API key at https://kabbo.app (Settings > Developer > Create Key).

## Available tools

### Core CRUD
- **list_publications** — List all publications with optional `query`, `stage`, `limit`, `offset`
- **get_publication** — Get a single publication by `id`
- **create_publication** — Create a publication (title required, stage defaults to "idea")
- **update_publication** — Update any field on a publication by `id`
- **move_stage** — Move a publication to a new stage by `id` and `stage`
- **delete_publication** — Soft-delete (bin) a publication by `id`

### Analytics & insights
- **get_pipeline_summary** — Counts by stage, stalled papers (30+ days), recently updated
- **get_stalled_papers** — Papers inactive for N days (default 30), sorted by staleness
- **get_analytics** — Publication velocity, avg time per stage, breakdowns by author/theme/grant/year
- **get_activity_log** — Recent activity from all sources (web, API, MCP, webhook) with date filtering

### Search & batch
- **search_publications** — Multi-field search across title, authors, notes, themes, grants, year
- **bulk_update** — Update multiple publications at once with an array of {id, ...updates}

### Reminders
- **manage_reminders** — CRUD on reminders: action "list", "create", "complete", or "delete"

### Team
- **get_team_summary** — Team pipeline: member count, papers by stage per member, stalled papers

### Export
- **export_bibtex** — Generate BibTeX entries filtered by stage, year, or specific IDs

### Notes
- **add_note** — Append a timestamped note to a publication without overwriting existing notes

## Common workflows

### Morning check-in
"How's my pipeline looking?"
Uses: get_pipeline_summary

### Weekly review
"What changed in my pipeline this week?"
Uses: get_activity_log (days: 7)

### Find stalled work
"Which papers have been stuck longest?"
Uses: get_stalled_papers

### Annual review prep
"How many papers did I publish this year vs last year?"
Uses: get_analytics

### Team oversight
"How are my students' papers progressing?"
Uses: get_team_summary (team_id required)

### Search
"Find all papers about colonial wages"
Uses: search_publications (query: "colonial wages")

### Batch operations
"Add grant NRF-2026 to all my submitted papers"
Uses: list_publications (stage: "submitted"), then bulk_update with grant added

### Set a reminder
"Remind me to resubmit by June 15"
Uses: manage_reminders (action: "create", title: "Resubmit", due_date: "2026-06-15")

### Export citations
"Give me BibTeX for all published papers since 2024"
Uses: export_bibtex (stage: "published", year: 2024)

### Add a note
"Note on the climate paper: reviewer 2 wants robustness checks"
Uses: search_publications to find the paper, then add_note with the text

## Tips

- Always search by title before creating a new publication to avoid duplicates
- The `create_publication` endpoint does upsert: if a publication with the same title exists, it updates instead of duplicating
- Stage names use underscores: `revise_resubmit`, not `revise-resubmit`. Common aliases (r&r, wip, in-review) are accepted
- `get_pipeline_summary` is the best single-call overview of your entire pipeline
- `add_note` timestamps and appends; it never overwrites existing notes
- For team operations, you need the team UUID — ask the user or use the Kabbo web UI to find it

## Valid stages

idea, draft, submitted, revise_resubmit, resubmitted, accepted, published
