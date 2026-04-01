# PubZub Strategic Plan
## From Lovable Prototype to the Academic Publication Tool of Choice

**Author:** Johan Fourie (with Claude)
**Date:** 2026-04-01
**Status:** Planning

---

## 1. What PubZub Is Today

### Overview
PubZub is a **Kanban-style academic publication pipeline manager** that lets researchers drag-and-drop papers through seven stages: Idea → Draft → Submitted → Revise & Resubmit → Resubmitted → Accepted → Published.

### Tech Stack
- **Frontend:** React 18 + TypeScript 5.8, Vite 5.4, Tailwind CSS 3.4, shadcn/ui (Radix primitives)
- **Backend:** Supabase (PostgreSQL 14 + Auth + Realtime + Edge Functions on Deno)
- **Deployment:** Currently on Lovable platform; Supabase at `mbopyumuykfdskclhocr.supabase.co`

### Current Feature Set

**Core Pipeline:**
- Drag-and-drop publications across 7 pipeline stages
- Publication metadata: title, authors, themes, grants, target year, output type (journal/book/chapter), journal/publisher name, working paper tracking, notes, custom links
- Collaboration links (GitHub, Overleaf, Prism, custom)
- Stage history tracking (records every stage transition with timestamp)
- Undo/redo for moves (stack of 80)
- Search and filter by author, theme, grant, year
- Vertical and horizontal pipeline views
- Published section grouped by year (configurable year limit)

**Team Collaboration:**
- Create teams with name, description, logo
- Invite members by email with roles: admin, member
- Selective visibility: team leaders choose minimum visible stage per member (e.g., supervisors see "Draft" onwards, not "Ideas")
- Team dashboard with aggregate analytics
- View individual team member pipelines (read-only or editable by role)
- Team analytics and report export

**Publication Sharing:**
- Invite collaborators to individual publications (viewer or editor role)
- Real-time presence tracking (see who's viewing which publication)
- Comments/discussion thread on each publication
- Invitation management (accept/decline)

**Data Import/Export:**
- BibTeX import (parse .bib files, bulk create publications)
- BibTeX export (download published items as .bib)
- PDF export with customizable pipeline layout
- Excel export (pipeline + summary sheets)
- Analytics export (CSV and Excel with multiple sheets)

**User Experience:**
- Google/Apple OAuth + email/password authentication
- User profiles (display name, avatar, university, ORCID, Google Scholar URL, personal website)
- Keyboard shortcuts
- Onboarding tooltips and quick-start guide
- Offline support with sync queue
- Light/dark mode
- Customizable color palettes
- Paper file upload/download (Supabase Storage)

**API & Integration:**
- MCP server with 6 tools (list, get, create, update, move_stage, delete)
- REST API (GET list/search, PATCH update, DELETE soft-delete) with API key auth
- GitHub webhook (HMAC-verified, parses `.pubzub.yaml`, reads `[stage:xxx]` commit tags)
- Ingest endpoint (upsert by title match)
- Activity logging (tracks source: web/api/webhook/mcp)
- API key management (SHA-256 hashed, prefix display, usage tracking)

### Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `profiles` | User info: display_name, avatar_url, university_affiliation, orcid_id, google_scholar_url, personal_website_url |
| `publications` | Core data: id, owner_id, title, authors[], stage, target_year, themes[], grants[], output_type, notes, links[], github_repo, overleaf_link, data_sources[], related_papers[], working_paper (JSONB), stage_history[], created_at, updated_at |
| `publication_bin` | Soft-deleted publications (user_id, publication_data JSONB, original_stage, deleted_at) |
| `publication_collaborators` | Sharing: publication_id, user_id, invited_email, role (viewer/editor), status (pending/accepted/declined) |
| `publication_comments` | Discussion: publication_id, user_id, content, created_at |
| `reminders` | Deadlines: publication_id, user_id, title, description, due_date, reminder_type, is_completed |
| `teams` | Team info: name, description, logo_url, created_by, dashboard_public |
| `team_members` | Membership: team_id, user_id, invited_email, role (admin/member), status, has_dashboard_access |
| `visibility_settings` | Per-user per-team: min_visible_stage (enum) |
| `api_keys` | Auth: user_id, name, key_hash, key_prefix, last_used_at |
| `activity_log` | Audit: user_id, source, action, publication_id, publication_title, details JSONB, pubzub_yaml_detected |

All tables have comprehensive RLS (Row-Level Security) policies. 43 incremental SQL migrations.

### Project Structure

```
pubzub/
├── src/
│   ├── pages/           # 6 route pages (Index, Auth, TeamWorkspace, About, ResetPassword, NotFound)
│   ├── components/      # 34 custom components + 41 shadcn/ui components
│   │   ├── PublicationCard.tsx        # Card display on pipeline
│   │   ├── PublicationDrawer.tsx      # Rich sidebar editor
│   │   ├── PublicationChat.tsx        # Comments/discussion
│   │   ├── PipelineStage.tsx          # Stage column
│   │   ├── TeamsModal.tsx             # Team management (~900 lines)
│   │   ├── AnalyticsModal.tsx         # Statistics & co-author network
│   │   ├── ProfileSettingsModal.tsx   # User profile + API keys + MCP setup
│   │   ├── BibtexImportModal.tsx      # BibTeX import
│   │   ├── ExportPdfModal.tsx         # PDF export
│   │   ├── FilterBar.tsx              # Search and filters
│   │   ├── AppHeader.tsx              # Top navigation
│   │   ├── TeamDashboardView.tsx      # Team overview
│   │   ├── TeamMemberPipeline.tsx     # Individual member view
│   │   ├── TeamAnalyticsView.tsx      # Team statistics
│   │   ├── CoAuthorNetworkGraph.tsx   # Network visualization
│   │   └── ui/                        # shadcn/ui primitives
│   ├── hooks/           # 15 custom hooks
│   │   ├── useSupabasePublications.ts # Core CRUD (~860 lines)
│   │   ├── useTeams.ts               # Team management
│   │   ├── useCollaborations.ts      # Publication sharing
│   │   ├── usePublicationPresence.ts  # Real-time presence
│   │   ├── usePublicationComments.ts  # Comments
│   │   ├── useVisibilitySettings.ts   # Team visibility
│   │   ├── useOfflineQueue.ts         # Offline support
│   │   ├── useKeyboardShortcuts.ts    # Keyboard nav
│   │   ├── useOnboarding.ts           # First-time flow
│   │   └── usePalette.ts             # Theme customization
│   ├── integrations/
│   │   ├── lovable/index.ts           # Lovable OAuth wrapper (TO BE REPLACED)
│   │   └── supabase/
│   │       ├── client.ts             # Supabase client init
│   │       └── types.ts              # Auto-generated DB types
│   ├── lib/
│   │   ├── bibtex.ts                 # BibTeX parsing/generation
│   │   ├── pipelineExport.ts         # Excel export
│   │   ├── analyticsExport.ts        # Analytics export
│   │   ├── storage.ts                # Local storage & sample data
│   │   └── utils.ts                  # General utilities
│   └── types/
│       ├── publication.ts            # Publication, Stage, Board, Bin types
│       └── team.ts                   # Team, TeamMember, VisibilitySettings types
├── supabase/
│   ├── config.toml                   # Supabase config
│   ├── migrations/                   # 43 SQL migrations
│   └── functions/
│       ├── mcp-server/index.ts       # MCP server (6 tools, mcp-lite + Hono)
│       ├── api-publications/index.ts # REST API
│       ├── github-webhook/index.ts   # GitHub push handler
│       └── ingest-publication/index.ts # Upsert endpoint
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
└── .env                              # Supabase credentials
```

### Half-Built Features (Type/DB exists, no UI)

| Feature | DB/Type Status | What's Missing |
|---------|---------------|----------------|
| **Reminders/Deadlines** | `reminders` table exists, `Reminder` type defined | `useReminders` hook, UI in PublicationDrawer, global widget |
| **Data Sources** | `data_sources` column in publications, `DataSource` type defined | List editor in PublicationDrawer |
| **Related Papers** | `related_papers` column, `RelatedPaper` type with relationship types | List editor in PublicationDrawer, cross-linking |
| **Board Customization** | `updateBoard()` is a no-op (line 825-828 in useSupabasePublications) | Persistence layer (boards table or profiles JSON) |
| **GitHub Integration** | Fully implemented webhook edge function | UI documentation, connected repos display, test button |

---

## 2. Vision & Goals

### Target Users
1. **Individual academics** tracking their own publication pipeline (replacing spreadsheets, Notion, Trello)
2. **Team leaders** (lab directors, department heads, supervisors) tracking multiple researchers' progress

### Unique Differentiator
**Claude Code integration via MCP.** No other academic tool lets you say "How's my pipeline looking?" to Claude and get a structured answer. This is the killer feature for tech-forward academics.

### Principles
- **Free forever** — no monetization, this is a community tool
- **Beautiful design stays** — no UI redesign, the current aesthetic is a feature
- **Claude Code integration is THE selling point** — both for CC users (MCP) and non-CC users (smart suggestions, eventually in-app AI)
- **Low friction** — academics are busy; setup must be trivial, value must be immediate

---

## 3. The Plan: Five Phases

### Phase 1: Platform Independence
**Priority:** P0 (blocking everything else)
**Effort:** ~1-2 days
**Goal:** Own the domain, decouple from Lovable, deploy independently

#### 1.1 Domain Registration
- **Recommended:** `pubzub.com`
  - `.app` domains are HTTPS-enforced by default
  - Signals "this is an application" (not a blog or docs site)
  - Short, memorable, professional
- **Fallbacks:** `pubzub.io` (more developer-coded), `pubzub.dev` (also developer-coded)

#### 1.2 Hosting: Vercel
- Zero-config Vite deployment (connect GitHub repo → done)
- Free tier: 100GB bandwidth/month, unlimited static deploys, global edge network
- Automatic preview deployments for branches/PRs
- Custom domain setup is trivial
- Supabase backend stays exactly where it is — Vercel only hosts the static frontend
- **Alternative:** Cloudflare Pages (unlimited bandwidth on free tier, slightly more setup)

#### 1.3 Decouple from Lovable

There are exactly **5 files** to modify:

| # | File | What to Change |
|---|------|---------------|
| 1 | `src/integrations/lovable/index.ts` | Replace Lovable OAuth wrapper with native Supabase `signInWithOAuth({ provider: 'google' })` |
| 2 | `src/pages/Auth.tsx` | Remove `import { lovable }` (line 4), replace `lovable.auth.signInWithOAuth("google", ...)` (line 135) with Supabase call |
| 3 | `vite.config.ts` | Remove `import { componentTagger } from "lovable-tagger"` and the plugin from the plugins array |
| 4 | `package.json` | Remove `@lovable.dev/cloud-auth-js` from dependencies, `lovable-tagger` from devDependencies |
| 5 | `index.html` | Update OG image URL (currently `lovable.dev/opengraph-image-p98pqg.png`), update `twitter:site` from `@Lovable`, set canonical URL to `pubzub.com` |

#### 1.4 Post-Migration Checklist
- [ ] Add `https://pubzub.com` to Supabase Dashboard → Authentication → URL Configuration (redirect URLs + site URL)
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel environment variables
- [ ] Configure Google OAuth app redirect URI to `https://pubzub.com` (in Google Cloud Console)
- [ ] Rewrite `README.md` as proper public-facing documentation
- [ ] Create OG image for `pubzub.com` social sharing
- [ ] Test auth flow end-to-end on new domain
- [ ] Set up Vercel Analytics (free) for basic usage tracking

---

### Phase 2: Claude Code — The Killer Feature
**Priority:** P1
**Effort:** ~1-2 weeks
**Goal:** Make PubZub indispensable for Claude Code users, and useful for everyone else

#### 2A. Enhanced MCP Server

The current MCP server (`supabase/functions/mcp-server/index.ts`) has 6 tools. Expand to ~16 tools:

**Existing tools (keep as-is):**
1. `list_publications` — List with optional search, stage filter, pagination
2. `get_publication` — Fetch single by ID
3. `create_publication` — Create new (title required)
4. `update_publication` — Update fields
5. `move_stage` — Shorthand for stage changes
6. `delete_publication` — Soft-delete to bin

**New tools to add:**

| # | Tool | Purpose | Example Prompt |
|---|------|---------|---------------|
| 7 | `get_pipeline_summary` | Counts by stage, recently updated papers, stalled papers (no update in 30+ days), upcoming deadlines | "How's my pipeline looking?" |
| 8 | `search_publications` | Full-text search across title, authors, notes, themes. Filter by multiple fields simultaneously | "Find all papers about colonial wages" |
| 9 | `bulk_update` | Accept array of `{id, updates}` pairs for batch operations | "Add grant NRF-2026 to all my submitted papers" |
| 10 | `get_activity_log` | Recent activity from all sources (web, api, mcp, webhook) with date range filter | "What changed in my pipeline this week?" |
| 11 | `manage_reminders` | Create, list, update, complete, delete reminders. DB table already exists | "Remind me to resubmit the wages paper by June 15" |
| 12 | `get_analytics` | Conversion rates stage-to-stage, average time per stage, publication velocity (papers/year), breakdown by author/theme/grant | "How many papers did I publish this year vs last year?" |
| 13 | `get_team_summary` | Team-level pipeline summary: member count, total papers, papers by stage per member, stalled papers | "How are my students' papers progressing?" |
| 14 | `export_bibtex` | Generate BibTeX string for selected or all publications, filtered by stage/year | "Give me BibTeX for all my published papers since 2024" |
| 15 | `add_note` | Append to a publication's notes without overwriting existing content | "Add a note to the climate paper: reviewer 2 wants robustness checks" |
| 16 | `get_stalled_papers` | Papers that haven't changed stage in N days (default 30), sorted by staleness | "Which papers have been stuck the longest?" |

**Implementation notes:**
- All new tools follow the existing pattern in `mcp-server/index.ts`
- Most query the `publications` table directly; `manage_reminders` queries the `reminders` table
- `get_team_summary` uses the existing `get_team_dashboard_data` RPC function
- `export_bibtex` reuses the BibTeX generation logic from `src/lib/bibtex.ts` (port to Deno)
- `get_analytics` computes metrics server-side from stage_history timestamps

#### 2B. Frictionless Setup for Claude Code Users

**Step 1 (do first): Improve in-app setup UX**

The `ProfileSettingsModal.tsx` already has an MCP Server section. Enhance it:
- One-click "Copy MCP config to clipboard" button that generates:
  ```json
  {
    "mcpServers": {
      "pubzub": {
        "type": "url",
        "url": "https://mbopyumuykfdskclhocr.supabase.co/functions/v1/mcp-server?api_key=pz_YOUR_KEY_HERE"
      }
    }
  }
  ```
- "Test Connection" button that pings the MCP server and shows success/failure
- Clear step-by-step instructions: "1. Generate an API key above. 2. Copy the config below. 3. Add it to your Claude Code settings."
- Link to Claude Code docs for where to paste the config

**Step 2 (do later): `npx pubzub-setup` CLI**
- Interactive CLI that prompts for API key
- Detects Claude Code installation
- Writes config to `~/.claude.json` (global) or `.mcp.json` (project)
- Confirms connection with a test call
- This is a separate npm package (`pubzub-setup`)

#### 2C. PubZub Skill File for Claude Code

Create a distributable skill file that users can place at `~/.claude/skills/pubzub.md`:

```markdown
# PubZub — Publication Pipeline Manager

## What PubZub Is
PubZub tracks academic publications through: Idea → Draft → Submitted → Revise & Resubmit → Resubmitted → Accepted → Published.

## Available MCP Tools
[list all tools with descriptions and parameter schemas]

## Common Workflows
- "How's my pipeline?" → get_pipeline_summary
- "Move paper X to submitted" → search by title, then move_stage
- "Add a note to paper Y" → search by title, then add_note
- "What's stalled?" → get_stalled_papers
- "Annual review summary" → get_analytics with year filter
- "Team status" → get_team_summary

## Tips
- Always search by title before operating on a publication (users remember titles, not UUIDs)
- When moving to "published", include the published_year
- Use bulk_update for batch operations rather than multiple update calls
```

This skill file could be:
- Downloadable from `pubzub.com/skill`
- Auto-installed by `npx pubzub-setup`
- Linked in the ProfileSettingsModal setup instructions

#### 2D. Smart Suggestions for Non-Claude-Code Users

**Rule-based insights (no API cost, computed client-side):**

Create an "Insights" panel on the main dashboard that surfaces actionable observations:

| Category | Example Insight | Logic |
|----------|----------------|-------|
| **Stalled** | "Colonial Wages has been in R&R for 92 days" | `now - last stage_history entry > 30 days` |
| **Missing data** | "3 papers have no target year set" | `completionYear === '' or undefined` |
| **Momentum** | "You submitted 5 papers this year, up from 3 last year" | Compare stage transitions by year |
| **Approaching deadline** | "2 papers target 2026 but are still in Idea stage" | `completionYear === currentYear && stage === 'idea'` |
| **Quick wins** | "You have 2 accepted papers — update them to Published when ready" | `stage === 'accepted'` count |
| **Completeness** | "4 papers have no authors listed" | `authors === ''` |
| **Celebration** | "You published 3 papers this year!" | Published count for current year |

Implementation: A `useInsights` hook that computes these from existing publication data. A collapsible `InsightsPanel` component on the main dashboard. No new API calls needed.

---

### Phase 3: Complete Half-Built Features
**Priority:** P1-P2
**Effort:** ~1 week
**Goal:** Finish features where DB/types already exist but UI is missing

#### 3.1 Reminders & Deadlines (P1 — high impact)

**What exists:**
- `reminders` table in Supabase with columns: id, publication_id, user_id, title, description, due_date, reminder_type, is_completed, created_at
- `Reminder` type in `src/types/publication.ts`: `{ id?, title, description?, dueDate, reminderType, isCompleted }`
- RLS policies on the reminders table

**What to build:**
1. `useReminders` hook — CRUD operations against the `reminders` table
2. "Reminders" section in `PublicationDrawer` — add/edit/complete/delete reminders per publication
3. Global "Upcoming Deadlines" widget — collapsible panel on main dashboard showing next 5-10 due reminders across all publications
4. Visual indicator on `PublicationCard` — small icon when a publication has an upcoming reminder
5. Browser Notification API — opt-in notifications for due reminders (with permission prompt)

**Reminder types to support:**
- Conference deadline
- Resubmission window
- Review response deadline
- Grant report due
- Custom

**Why this matters:** Conference deadlines, resubmission windows, and review response deadlines are the lifeblood of academic publishing. Missing a deadline can mean waiting another year.

#### 3.2 Data Sources UI (P2)

**What exists:**
- `data_sources` column in publications table (text array mapped to JSONB)
- `DataSource` type: `{ name: string; url: string; description?: string }`

**What to build:**
- "Data Sources" accordion section in `PublicationDrawer`
- Simple list editor: add/edit/remove data sources with name, URL, optional description
- Each entry renders as a clickable link

**Why this matters:** Empirical researchers need to track which datasets they use across papers. Useful for data availability statements and replication packages.

#### 3.3 Related Papers UI (P2)

**What exists:**
- `related_papers` column in publications table
- `RelatedPaper` type: `{ title: string; url?: string; relationship: 'cites' | 'cited-by' | 'related' | 'extends' | 'replicates' }`

**What to build:**
- "Related Papers" accordion section in `PublicationDrawer`
- List editor with title, URL, relationship type dropdown
- Optional: if the related paper title matches another PubZub publication, auto-link it (cross-reference within own pipeline)

**Why this matters:** Helps researchers see connections across their own work and track citation networks.

#### 3.4 GitHub Integration Documentation (P2)

**What exists:** A fully implemented `github-webhook` edge function that:
- Verifies HMAC-SHA256 signatures
- Reads `.pubzub.yaml` config files from pushed repos
- Extracts `[stage:xxx]` tags from commit messages
- Creates/updates publications automatically
- Normalizes stage names (wip → draft, r&r → revise_resubmit, etc.)

**What to build:**
- "GitHub Integration" section in `ProfileSettingsModal`
- Step-by-step setup guide: how to add the webhook URL and secret to a GitHub repo
- Example `.pubzub.yaml` file format
- Example commit message with `[stage:submitted]` tag
- List of connected repos (query activity_log where source='webhook')
- Test/ping button

---

### Phase 4: Features for Adoption
**Priority:** P2-P3
**Effort:** ~2-4 weeks
**Goal:** Reduce onboarding friction, add features that make academics choose PubZub over spreadsheets

#### 4.1 For Individual Researchers

**CSV/Spreadsheet Import (P2 — highest impact for adoption)**
- Many academics currently track publications in Excel or Google Sheets
- Build a CSV importer that maps columns to PubZub fields (title, authors, stage, journal, year, etc.)
- Column auto-detection with preview before import
- Add to existing import UI alongside BibTeX import
- This is the single biggest onboarding friction reducer

**ORCID Import (P2)**
- The `orcid_id` field already exists in the `profiles` table
- Use the ORCID public API (`pub.orcid.org/v3.0/{orcid-id}/works`) to fetch a researcher's published works
- Auto-import into PubZub as "Published" stage publications
- One-click: "Import your ORCID publications"
- Powerful onboarding: new users immediately see their published work in PubZub

**Progress Visualization (P3)**
- Enhance `AnalyticsModal` with:
  - Timeline view: when each paper moved through stages (using stage_history data)
  - Publication velocity chart: papers published per year over time
  - Stage funnel: how many papers survive from Idea → Published
  - Average time-to-publish by output type

**Semantic Scholar Integration (P3)**
- Google Scholar has no official API; Semantic Scholar does (free, rate-limited)
- Auto-populate published papers from a researcher's Semantic Scholar profile
- Alternative data source for researchers without ORCID

**Zotero Integration (P3)**
- Zotero has a web API
- Import from a Zotero library into PubZub
- Useful for researchers who already have organized references

#### 4.2 For Team Leaders

**Annual Review Export (P2 — high impact)**
- Per-member publication summary for a given year
- Export as PDF or Excel: "Here's what researcher X published/submitted/started in 2026"
- Exactly what department heads need for annual performance reviews
- Uses existing `TeamReportExport.tsx` component as starting point

**Grant Progress View (P2)**
- The `grants` field already exists on publications
- New view that groups papers by grant
- Shows: which grants are producing output, which are stalled
- Useful for grant reporting to funders

**Publication Velocity Metrics (P3)**
- Papers per year per team member
- Average time from submission to publication
- R&R success rate (resubmitted → accepted conversion)
- Sensitive data — respect existing visibility controls

**Email Notifications (P3)**
- Team invitations (currently in-app only)
- Deadline reminders
- Weekly pipeline digest (opt-in)
- Use Supabase Edge Functions + Resend or similar transactional email service

#### 4.3 Landing Page & Growth Strategy

**Landing Page at `pubzub.com` (P2)**
- Transform the existing About page into a proper marketing landing page
- Sections: Hero with screenshot, Feature highlights, "Claude Code integration" story, Quick-start guide, Team features callout
- Social proof: "Used by researchers at Stellenbosch University"
- Call to action: "Sign up free — no credit card needed"

**Academic Social Media (P2)**
- Bluesky/X thread: "I built a free tool for managing my publication pipeline. No more spreadsheets."
- Focus on pain points: tracking R&Rs, deadline management, team oversight
- The Claude Code angle: "I can ask Claude 'what papers are stalled?' and it tells me"
- Share demo GIF/video

**Start at Stellenbosch (P1)**
- Get 10 colleagues in the Economics department using it
- Team features create network effects (teams invite members who invite others)
- Real users provide real feedback

**2-Minute Demo Video (P2)**
- Record: create publication, drag through stages, show team view, demonstrate Claude Code interaction
- Embed on landing page
- Share on academic social media

**Conference Presentation (P3)**
- Lightning talk at an economics conference
- "Managing your research pipeline with AI assistance"
- Live demo with Claude Code

#### 4.4 In-App AI Assistant (P3 — for non-CC users)

**Architecture:**
- New Supabase Edge Function: `supabase/functions/ai-assistant/index.ts`
- Receives natural language query + user's pipeline data
- Calls Claude API (Haiku for cost efficiency) with pipeline context as system prompt
- Returns structured response

**Use cases:**
- "Which journals should I submit this paper to?" (based on themes, field, output type)
- "Summarize my pipeline status for my annual review" (natural language summary)
- "What should I focus on next?" (prioritization based on deadlines, stage staleness)
- "Compare my output this year vs last year"

**Cost management (app is free, API calls cost money):**
- Rate limit: 10 queries per user per day
- Use Claude Haiku (cheapest, still excellent for structured data analysis)
- Cache common query patterns
- Show cost transparency: "This feature is powered by Claude AI and rate-limited to keep PubZub free"

**UI:**
- Repurpose the `PublicationChat` component pattern for a global AI chat panel
- Floating chat button on dashboard
- Chat history persisted locally (localStorage)

---

### Phase 5: Technical Hardening
**Priority:** P3-P4 (ongoing)
**Goal:** Security, performance, reliability, testing

#### Security
- **CORS:** Tighten from `Access-Control-Allow-Origin: "*"` to `pubzub.com` on all 4 edge functions
- **Rate limiting:** Add rate limits to API endpoints (Supabase Edge Function middleware or Cloudflare)
- **API key security:** Document that MCP query-param API keys are for MCP transport compatibility only; prefer header-based auth where possible
- **Content Security Policy:** Add CSP headers via Vercel config

#### Performance
- **Lazy loading:** The app loads all modals upfront. Lazy-load: `AnalyticsModal`, `TeamsModal`, `BibtexImportModal`, `ExportPdfModal`, `ProfileSettingsModal` using `React.lazy()` + `Suspense`
- **Bundle analysis:** Run `vite-bundle-visualizer` to identify other optimization opportunities
- **Image optimization:** Use Vercel Image Optimization for avatars and team logos

#### Testing (no tests exist today)
1. **Edge function tests** (highest priority) — API, MCP server, webhook handle auth and data; test happy paths and error cases
2. **Hook tests** — `useSupabasePublications` is the core data layer (~860 lines); test CRUD operations, optimistic updates, offline queue
3. **E2E tests** — Playwright for critical flows: login, create publication, move stage, invite collaborator, export
4. **Accessibility** — Run axe-core audit; shadcn/ui components are accessible by default but custom components may have gaps

#### Reliability
- **Error boundaries:** Add React error boundaries around the main pipeline view and team views to prevent white-screen crashes
- **Offline queue verification:** Test edge cases: sync conflicts when coming back online, duplicate prevention, partial sync failure recovery
- **Monitoring:** Sentry or similar for frontend error tracking (free tier)

---

## 4. Priority Matrix

| Priority | Item | Impact | Effort | Phase |
|----------|------|--------|--------|-------|
| **P0** | Domain registration (`pubzub.com`) | Unblocking | 1 hour | 1 |
| **P0** | Lovable decoupling (5 files) | Unblocking | 4-6 hours | 1 |
| **P0** | Vercel deployment | Unblocking | 1-2 hours | 1 |
| **P1** | Enhanced MCP tools (10 new tools) | Very High | 3-5 days | 2 |
| **P1** | MCP setup UX (copy-paste config) | High | 4 hours | 2 |
| **P1** | Reminders/deadlines UI | High | 2-3 days | 3 |
| **P1** | Start at Stellenbosch (10 users) | High | Ongoing | 4 |
| **P1** | PubZub skill file for Claude Code | High | 4 hours | 2 |
| **P2** | Rule-based smart suggestions | Medium-High | 2 days | 2 |
| **P2** | CSV import | High | 2 days | 4 |
| **P2** | ORCID import | High | 2-3 days | 4 |
| **P2** | Landing page | Medium-High | 2 days | 4 |
| **P2** | Annual review export | High | 2-3 days | 4 |
| **P2** | Data sources + related papers UI | Medium | 1-2 days | 3 |
| **P2** | Grant progress view | Medium | 2 days | 4 |
| **P2** | Academic social media launch | Medium | 1 day | 4 |
| **P3** | GitHub integration docs/UI | Medium | 1 day | 3 |
| **P3** | Progress visualization | Medium | 3 days | 4 |
| **P3** | `npx pubzub-setup` CLI | Medium | 2 days | 2 |
| **P3** | In-app AI assistant | Medium | 5-7 days | 4 |
| **P3** | Publication velocity metrics | Medium | 2 days | 4 |
| **P3** | Email notifications | Medium | 3 days | 4 |
| **P3** | Demo video | Medium | 1 day | 4 |
| **P3** | Board customization persistence | Low | 1 day | 3 |
| **P4** | Tighten CORS/security | Low | 1 day | 5 |
| **P4** | Lazy-load modals | Low | 4 hours | 5 |
| **P4** | Testing suite | Medium | 5-7 days | 5 |
| **P4** | Semantic Scholar integration | Low | 3 days | 4 |
| **P4** | Zotero integration | Low | 3-4 days | 4 |

---

## 5. Key Files Reference

| Purpose | File Path |
|---------|-----------|
| **TO REPLACE: Lovable OAuth** | `src/integrations/lovable/index.ts` |
| **TO MODIFY: Auth page** | `src/pages/Auth.tsx` |
| **TO MODIFY: Vite config** | `vite.config.ts` |
| **TO MODIFY: Package deps** | `package.json` |
| **TO MODIFY: HTML entry** | `index.html` |
| **TO EXPAND: MCP server** | `supabase/functions/mcp-server/index.ts` |
| **TO EXPAND: REST API** | `supabase/functions/api-publications/index.ts` |
| **REFERENCE: Core data hook** | `src/hooks/useSupabasePublications.ts` |
| **REFERENCE: Publication types** | `src/types/publication.ts` |
| **REFERENCE: Team types** | `src/types/team.ts` |
| **TO MODIFY: Profile settings** | `src/components/ProfileSettingsModal.tsx` |
| **TO MODIFY: Publication editor** | `src/components/PublicationDrawer.tsx` |
| **TO MODIFY: Main dashboard** | `src/pages/Index.tsx` |
| **REFERENCE: GitHub webhook** | `supabase/functions/github-webhook/index.ts` |
| **REFERENCE: Ingest endpoint** | `supabase/functions/ingest-publication/index.ts` |
| **REFERENCE: Supabase DB types** | `src/integrations/supabase/types.ts` |
| **REFERENCE: BibTeX logic** | `src/lib/bibtex.ts` |
| **REFERENCE: Export logic** | `src/lib/pipelineExport.ts`, `src/lib/analyticsExport.ts` |
| **REFERENCE: Analytics modal** | `src/components/AnalyticsModal.tsx` |
| **REFERENCE: Teams modal** | `src/components/TeamsModal.tsx` |

---

## 6. Success Metrics

| Metric | Target (6 months) | How to Measure |
|--------|-------------------|---------------|
| Registered users | 100+ | Supabase Auth dashboard |
| Active users (weekly) | 30+ | Activity log queries |
| Teams created | 10+ | Teams table count |
| MCP connections | 20+ | API keys with source='mcp' in activity_log |
| Publications tracked | 1,000+ | Publications table count |
| Stellenbosch adoption | 10+ colleagues | Direct observation |
| Social media reach | 1 viral thread | Engagement metrics |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Supabase free tier limits | Medium | Monitor usage; upgrade to Pro ($25/mo) if needed; the free tier is generous (500MB DB, 5GB bandwidth, 50K monthly active users) |
| AI assistant costs | Medium | Rate limit aggressively; use Haiku; start with rule-based suggestions (Phase 2D) that cost nothing |
| Low adoption | High | Start with Stellenbosch colleagues; the tool solves a real pain point; Claude Code integration is genuinely novel |
| Lovable decoupling breaks auth | Medium | Test thoroughly on staging domain before switching DNS; keep Lovable deployment running until Vercel is confirmed working |
| MCP protocol changes | Low | mcp-lite is a thin wrapper; protocol is stabilizing; update as needed |
| Security incident (API key leak) | Medium | Keys are hashed; add key rotation UI; monitor activity_log for anomalies |

---

*This document provides complete context for any future Claude Code conversation to pick up where implementation left off. Read this file first, then check git log for what's been done.*
