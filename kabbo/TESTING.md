# Kabbo — manual test checklist

Walk through this before every deploy that touches
`src/hooks/useSupabasePublications.ts`, `src/hooks/publicationTransforms.ts`,
`src/hooks/useOfflineQueue.ts`, any `supabase/functions/*`, or any page that
mutates publications (`Index.tsx`, `Auth.tsx`, `TeamWorkspace.tsx`, the drawer,
the BibTeX modal, the bin).

> **Before you start:** `npm run dev` on a clean profile, sign in as yourself,
> and open the browser devtools → Network + Console panels. Every flow below
> should produce **zero red errors** in the console and a **confirmed
> Supabase request** (HTTP 2xx) in Network.

Each row has: **What to do** → **What you should see** → **What to check on
reload**. The third column is the only thing that matters — if it fails, data
is disappearing.

## Core publication flows

| # | Flow | Action | Expected live | Expected on hard-refresh |
|---|------|--------|---------------|--------------------------|
| 1 | New publication | Click + in the Idea column, type a title | Card appears in Idea with your title | Still there, same title, same column |
| 2 | Edit title | Open a card, change its title, close the drawer | Card shows new title | New title survives |
| 3 | Edit year | Open a published card, change its year | Card moves to the new year column | Still in the new year column |
| 4 | Drag between stages | Drag a card from Idea → Drafting | Card in Drafting, toast fires | Card in Drafting |
| 5 | Drag to Published | Drag a card from Drafting → Published/2026 | Card in 2026 column, toast "Congratulations!" | Card in 2026 |
| 6 | Drag to a specific year | Drag a published card to the 2024 column | Card in 2024 column | Card in 2024 |
| 7 | Drag to "Year unknown" | If the column is visible, drag a card into it | Card in unknown column | Still in unknown column |
| 8 | Move to bin | Open card → click trash icon | Card disappears from pipeline, appears in bin | Card still in bin, not in pipeline |
| 9 | Restore from bin | Open bin → click restore | Card reappears in its original stage | Still restored, bin is empty |
| 10 | Delete from bin | Open bin → click permanent delete | Card gone | Card gone (does not reappear) |
| 11 | Undo a stage move | Drag a card, then click Undo in the toolbar | Card back in the original stage | Back in original stage |

## BibTeX import (the flow that broke)

| # | Flow | Action | Expected live | Expected on hard-refresh |
|---|------|--------|---------------|--------------------------|
| 12 | Import 1 well-formed entry | Paste a single `@article` with title, authors, year | Toast "Imported 1 publication", card appears in the published column for that year | Card still there, all fields intact |
| 13 | Import 5 mixed entries | Paste 5 BibTeX entries: 3 with year, 1 with no year, 1 with no title | Toast "Imported 4, 1 not saved" (1 skipped, no-title). The 3-with-year appear in their year columns. The no-year one appears in the **"Year unknown"** column. | All 4 persist. Zero "Untitled" ghosts anywhere. |
| 14 | Import with network off | Devtools → Network → Offline. Import 1 entry. | Toast should show "failed to save — check your network and retry". Card does **not** appear in the pipeline. | Nothing new appears. |
| 15 | Drafts via `@unpublished` | Import a `@unpublished{...}` with just a title | Toast "Imported 1". Card appears in **Drafting** (not Published). | Still in Drafting |

## Edge cases to spot-check

| # | Flow | Action | Expected |
|---|------|--------|----------|
| 16 | Empty title edit | Open a card, clear its title, save | Title shows "Untitled publication" in the card. On reload the row persists with title="Untitled". |
| 17 | Change stage from Published to Drafting | Open a published card, move it back to Drafting | Card leaves the year column, enters Drafting. On reload, still in Drafting. |
| 18 | Missing-year Published row clean-up | If the "Year unknown" column is showing, open one of those cards and set a year | Card moves to the correct year column. Year-unknown column disappears if empty. |
| 19 | Filter by author | Type an author in the filter bar | Only their papers show in every column, including Year unknown |
| 20 | 7-year window | Use the year-limit control in the FilterBar | Only the last N years of published columns show; the Year unknown column still shows regardless of limit |

## After every commit — the 60-second smoke

Minimum every time you push:

1. **`npm test`** → all green (should take under 2 seconds).
2. **`npx tsc --noEmit`** → clean.
3. **`npm run build`** → clean.
4. `npm run dev`, sign in, do rows **1, 5, 8, 12, 14** from the tables above — the five flows that historically broke.
5. Hard-refresh the browser after step 4 and confirm everything persisted.

If all five pass, the push is safe.

## If something goes wrong

- **A row shows in the UI but not after reload.** Something is writing to
  optimistic state without reaching Supabase. Check the Network panel for a
  missing request; check the Console for a swallowed error.
- **A row is missing from the UI but exists in Supabase.** Something in
  `dbToLocal` / `publishedByYear` is dropping it. Re-run `npm test` — the
  visibility invariant at `persistence.test.ts:219` should fail first.
- **"Untitled" rows appear after import.** Regression in the BibTeX flow.
  `handleBibtexImport` in `src/pages/Index.tsx` should be routing through
  `addPublicationWithData`, not the old `addPublication` + `updatePublication`.
  If it's reverted, grep for either pattern and restore the atomic call.

## Not yet automated (future work)

- **Integration test against a real Supabase project.** Scaffolded at
  `scripts/integration-test.mjs`. Requires a disposable test user and a
  `.env.test` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
  a test user's email+password. Once provisioned, run with
  `npm run test:integration`.
- **Playwright E2E.** Nothing yet. Would give the highest confidence at the
  highest setup cost.
