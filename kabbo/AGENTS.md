# Kabbo — Publication Pipeline Agent

Kabbo is an academic publication pipeline tracker at https://kabbo.app.
This project connects to the Kabbo MCP server, which exposes tools for managing
publications through seven stages: Idea, Draft, Submitted, Revise & Resubmit,
Resubmitted, Accepted, Published.

## MCP server

```
https://jydnsbaztvmjkebhmoia.supabase.co/functions/v1/mcp-server
```

Authenticate with the `x-api-key: YOUR_KEY` header. Generate a key at
https://kabbo.app (Settings → AI Integration → Create Key). The same server
backs Claude Code (the plugin) and Gemini CLI (`~/.gemini/settings.json`, using
`httpUrl`).

## Available tools

### Core CRUD
- `list_publications` — list with optional query, stage, limit, offset
- `get_publication` — get one by id
- `create_publication` — create (title required, stage defaults to "idea"; upserts by title)
- `update_publication` — update any field by id
- `move_stage` — move to a new stage by id and stage
- `delete_publication` — soft-delete by id

### Analytics
- `get_today` — what needs your attention today (overdue reminders, revisions waiting, decisions to chase); same list as the dashboard's Today button
- `get_pipeline_summary` — counts by stage, stalled papers, recently updated
- `get_stalled_papers` — papers inactive for N days (default 30)
- `get_analytics` — velocity, avg time per stage, breakdowns by author/theme/grant/year/output_type
- `get_activity_log` — recent activity with date filtering (sources: api, mcp)

### Search & batch
- `search_publications` — multi-field search (title, authors, notes, themes, grants, year)
- `bulk_update` — array of {id, ...updates}

### Workflow & metadata
- `link_repo` — attach a github_repo URL and/or overleaf_url to a publication (where the data or source lives)
- `set_target_journal` — set the intended journal
- `import_bibtex` — create publications from a BibTeX string
- `manage_related_papers` — list/add/remove related papers
- `manage_data_sources` — list/add/remove data sources
- `manage_submissions` — the journal-by-journal record: action list | add | decide | resubmitted | delete. `add` opens an attempt (journal defaults to target_journal) and moves an Idea/Draft paper to Submitted; `decide` records desk_reject / reject / revise_resubmit / accept / withdrawn and moves the paper accordingly
- `set_disposition` — pause, shelve or reactivate a paper with a reason and optional reconsider_at; resting papers are never reported as stalled

### Reminders / team / export / notes
- `manage_reminders` — action: list | create | complete | delete. Create needs
  `title` and an ISO `due_date`; `reminder_type` is one of deadline, conference,
  resubmission, working_paper, general (default general)
- `get_team_summary` — per-member pipeline breakdown (requires team_id and team
  dashboard access; each member's papers are cut at the visibility floor they set)
- `export_bibtex` — BibTeX filtered by stage, year, or ids
- `add_note` — append a timestamped note without overwriting

## Resources & prompts

The server also exposes MCP resources (`kabbo://pipeline/summary`,
`kabbo://publications`, `kabbo://publication/{id}`, `kabbo://activity/recent`)
and prompts (`morning_checkin`, `weekly_review`, `annual_report`,
`submission_prep`, `stalled_triage`). Clients that support resources/prompts can
use them directly; otherwise the equivalent tools cover the same ground.

## Updating the pipeline on request

The main job is to keep the pipeline current when the user asks. For example,
*"I just submitted the climate paper to the AER — update Kabbo"*:

1. `search_publications` to find the card by title.
2. `update_publication` to set `target_journal`, `authors`, `themes`, `notes`,
   and `link_repo` to record the GitHub/Overleaf URL where the data or source lives.
3. `move_stage` to the right column (here, `submitted`).

There is no GitHub or Overleaf automation — the repo and Overleaf links are plain
metadata you set directly via `link_repo` or `update_publication`.

## Common prompts

- "What needs me today?" → get_today
- "How's my pipeline looking?" → get_pipeline_summary
- "The JEH desk-rejected the wages paper yesterday" → manage_submissions (action: list to find the attempt, then decide)
- "I just sent the revised version back to EHR" → manage_submissions (action: resubmitted)
- "Park the missions paper until March, waiting on the archive" → set_disposition (paused, reconsider_at)
- "Which journals have treated me worst?" → get_analytics (breakdown_by: journal)
- "Which papers have been stuck longest?" → get_stalled_papers
- "How many papers did I publish this year vs last?" → get_analytics
- "Find all papers about colonial wages" → search_publications
- "Import these from my CV" (paste BibTeX) → import_bibtex
- "I submitted X to the AER — link the data repo and move it to submitted" → update_publication + link_repo + move_stage
- "Add grant NRF-2026 to all submitted papers" → list then bulk_update
- "BibTeX for all published papers since 2024" → export_bibtex

## Valid stages

idea, draft, submitted, revise_resubmit, resubmitted, accepted, published

Aliases accepted: wip→draft, r&r→revise_resubmit, in-review→submitted,
forthcoming→accepted.

## Project structure

- `src/` — React frontend (TypeScript, Vite, Tailwind, shadcn/ui)
- `plugin/` — the Kabbo Claude Code plugin (MCP config, skill, `/kabbo:status`)
- `supabase/functions/` — Deno edge functions (mcp-server, api-publications,
  ingest-publication); shared helpers in `_shared/`
- `supabase/migrations/` — PostgreSQL migrations
- `src/hooks/useSupabasePublications.ts` — core data layer

## Development

```bash
npm run dev          # Vite dev server
npm run build        # production build
```

Edge function deployment (Supabase CLI):
```bash
supabase functions deploy mcp-server --no-verify-jwt
```
