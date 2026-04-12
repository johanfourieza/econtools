# Kabbo — Publication Pipeline Agent

Kabbo is an academic publication pipeline tracker at https://kabbo.app.
This project connects to the Kabbo MCP server, which exposes 16 tools
for managing publications through seven stages: Idea, Draft, Submitted,
Revise & Resubmit, Resubmitted, Accepted, Published.

## MCP server

The MCP server is at:
```
https://jydnsbaztvmjkebhmoia.supabase.co/functions/v1/mcp-server
```

Authenticate with `?api_key=YOUR_KEY` query parameter or `x-api-key` header.
Generate a key at https://kabbo.app (Settings > Developer > Create Key).

## Available tools (16)

### Core CRUD
- `list_publications` — List with optional query, stage, limit, offset
- `get_publication` — Get one by id
- `create_publication` — Create (title required, stage defaults to "idea")
- `update_publication` — Update any field by id
- `move_stage` — Move to a new stage by id and stage
- `delete_publication` — Soft-delete by id

### Analytics
- `get_pipeline_summary` — Counts by stage, stalled papers, recently updated
- `get_stalled_papers` — Papers inactive for N days (default 30)
- `get_analytics` — Velocity, avg time per stage, breakdowns by author/theme/grant/year
- `get_activity_log` — Recent activity with date filtering

### Search & batch
- `search_publications` — Multi-field search (title, authors, notes, themes, grants, year)
- `bulk_update` — Array of {id, ...updates}

### Reminders
- `manage_reminders` — CRUD: action "list", "create", "complete", "delete"

### Team
- `get_team_summary` — Per-member pipeline breakdown (requires team_id)

### Export & notes
- `export_bibtex` — BibTeX entries filtered by stage, year, or ids
- `add_note` — Append timestamped note without overwriting

## Common prompts

- "How's my pipeline looking?" → get_pipeline_summary
- "Which papers have been stuck longest?" → get_stalled_papers
- "How many papers did I publish this year vs last?" → get_analytics
- "Find all papers about colonial wages" → search_publications
- "Add grant NRF-2026 to all submitted papers" → list then bulk_update
- "How are my students' papers progressing?" → get_team_summary
- "Remind me to resubmit by June 15" → manage_reminders
- "BibTeX for all published papers since 2024" → export_bibtex

## Valid stages

idea, draft, submitted, revise_resubmit, resubmitted, accepted, published

Aliases accepted: wip→draft, r&r→revise_resubmit, in-review→submitted,
forthcoming→accepted.

## Project structure

- `src/` — React frontend (TypeScript, Vite, Tailwind, shadcn/ui)
- `supabase/functions/` — Deno edge functions (mcp-server, api-publications,
  github-webhook, ingest-publications)
- `supabase/migrations/` — PostgreSQL migrations
- `src/hooks/useSupabasePublications.ts` — Core data layer (~860 lines)
- `src/hooks/useTeams.ts` — Teams hook (~435 lines)
- `src/data/kabboQuotes.ts` — ||kabbo wisdom quotes shown on stage transitions

## Development

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
```

Edge function deployment (Supabase CLI required):
```bash
supabase functions deploy mcp-server --no-verify-jwt
```
