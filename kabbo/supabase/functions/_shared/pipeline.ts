// Pure pipeline helpers shared by the mcp-server, api-publications and
// ingest-publication edge functions. No Deno or Supabase imports here, so the
// same file is unit-tested by Vitest from src/hooks/__tests__/pipeline.test.ts.

export const VALID_STAGES = [
  "idea",
  "draft",
  "submitted",
  "revise_resubmit",
  "resubmitted",
  "accepted",
  "published",
] as const;

export type Stage = (typeof VALID_STAGES)[number];

/** Mirrors public.get_stage_index() in Postgres. Unknown stages return -1. */
export function stageIndex(stage: string | null | undefined): number {
  return VALID_STAGES.indexOf((stage ?? "") as Stage);
}

const STAGE_ALIASES: Record<string, Stage> = {
  idea: "idea",
  ideas: "idea",
  draft: "draft",
  drafting: "draft",
  "in-progress": "draft",
  "in progress": "draft",
  "work-in-progress": "draft",
  wip: "draft",
  submitted: "submitted",
  "in-review": "submitted",
  "in review": "submitted",
  "under-review": "submitted",
  "under review": "submitted",
  revise: "revise_resubmit",
  "revise-resubmit": "revise_resubmit",
  revise_resubmit: "revise_resubmit",
  "r&r": "revise_resubmit",
  "revise and resubmit": "revise_resubmit",
  resubmitted: "resubmitted",
  accepted: "accepted",
  forthcoming: "accepted",
  published: "published",
};

/** Map a user- or agent-supplied stage label to a canonical stage, or null. */
export function normalizeStage(stage: string | null | undefined): Stage | null {
  if (!stage) return null;
  const key = String(stage).toLowerCase().trim();
  if (STAGE_ALIASES[key]) return STAGE_ALIASES[key];
  return (VALID_STAGES as readonly string[]).includes(key) ? (key as Stage) : null;
}

export interface HistoryEntry {
  from: string;
  to: string;
  at: string;
}

/** Coerce a raw stage_history column (jsonb[] or null) to well-formed entries. */
export function normalizeHistory(history: unknown): HistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return (history as unknown[]).filter(
    (h): h is HistoryEntry => !!h && typeof h === "object" && "to" in h && "at" in h,
  );
}

/**
 * Append a stage transition to a publication's stage_history. Returns the
 * normalised array unchanged when nothing moved so callers can skip the
 * write. The web client writes exactly this shape (see
 * useSupabasePublications.moveToStage).
 */
export function appendStageHistory(
  history: unknown,
  from: string | null | undefined,
  to: string,
  at: string = new Date().toISOString(),
): HistoryEntry[] {
  const current = normalizeHistory(history);
  if (!from || from === to) return current;
  return [...current, { from, to, at }];
}

/**
 * Whether a teammate may see a paper in `stage`, given the owner's minimum
 * visible stage for that team (visibility_settings.min_visible_stage,
 * default 'idea' = everything visible).
 */
export function isStageVisible(stage: string, minVisibleStage: string | null | undefined): boolean {
  const min = stageIndex(minVisibleStage ?? "idea");
  const idx = stageIndex(stage);
  if (idx < 0) return false;
  return idx >= (min < 0 ? 0 : min);
}

// ── submission attempts ──────────────────────────────────────────────────
// Must match the CHECK constraint on public.submission_attempts.decision.
export const DECISIONS = [
  "pending",
  "desk_reject",
  "reject",
  "revise_resubmit",
  "accept",
  "withdrawn",
] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  pending: "Under review",
  desk_reject: "Desk rejected",
  reject: "Rejected",
  revise_resubmit: "Revise & resubmit",
  accept: "Accepted",
  withdrawn: "Withdrawn",
};

/** Attempts that are still live at the journal. */
export function isOpenDecision(d: string): boolean {
  return d === "pending" || d === "revise_resubmit";
}

/**
 * Where the paper goes when a decision is recorded. A rejection or a
 * withdrawal puts it back in the author's hands (Draft); null = no change.
 */
export function stageForDecision(decision: string): Stage | null {
  switch (decision) {
    case "desk_reject":
    case "reject":
    case "withdrawn":
      return "draft";
    case "revise_resubmit":
      return "revise_resubmit";
    case "accept":
      return "accepted";
    default:
      return null;
  }
}

export function normalizeDecision(input: string | null | undefined): Decision | null {
  if (!input) return null;
  const key = String(input).toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/&/g, "and");
  const aliases: Record<string, Decision> = {
    pending: "pending", under_review: "pending", submitted: "pending", in_review: "pending",
    desk_reject: "desk_reject", desk_rejected: "desk_reject", desk: "desk_reject",
    reject: "reject", rejected: "reject",
    revise_resubmit: "revise_resubmit", revise_and_resubmit: "revise_resubmit", randr: "revise_resubmit",
    rr: "revise_resubmit", major_revision: "revise_resubmit", minor_revision: "revise_resubmit",
    accept: "accept", accepted: "accept", forthcoming: "accept",
    withdrawn: "withdrawn", withdraw: "withdrawn",
  };
  return aliases[key] ?? null;
}

// ── dispositions ─────────────────────────────────────────────────────────
export const DISPOSITIONS = ["active", "paused", "shelved"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export function normalizeDisposition(input: string | null | undefined): Disposition | null {
  const key = String(input ?? "").toLowerCase().trim();
  if (key === "active" || key === "resume" || key === "reactivate") return "active";
  if (key === "paused" || key === "pause" || key === "on_hold" || key === "hold") return "paused";
  if (key === "shelved" || key === "shelve" || key === "archived" || key === "abandoned") return "shelved";
  return null;
}

// Reminder types must match the CHECK constraint on public.reminders.
export const REMINDER_TYPES = [
  "deadline",
  "conference",
  "resubmission",
  "working_paper",
  "general",
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

const REMINDER_ALIASES: Record<string, ReminderType> = {
  deadline: "deadline",
  due: "deadline",
  grant_report: "deadline",
  grant: "deadline",
  conference: "conference",
  conference_deadline: "conference",
  talk: "conference",
  resubmission: "resubmission",
  resubmit: "resubmission",
  review_response: "resubmission",
  revision: "resubmission",
  working_paper: "working_paper",
  wp: "working_paper",
  general: "general",
  custom: "general",
  other: "general",
};

/** Map a free-form reminder type to one the database accepts. */
export function normalizeReminderType(input: string | null | undefined): ReminderType {
  if (!input) return "general";
  const key = String(input).toLowerCase().trim().replace(/[\s-]+/g, "_");
  return REMINDER_ALIASES[key] ?? "general";
}

/** Minimal BibTeX parser: enough to import title / author / year / journal. */
export function parseBibtex(bibtex: string): Array<Record<string, string>> {
  const entries: Array<Record<string, string>> = [];
  const blocks = bibtex.split(/@/).slice(1);
  for (const block of blocks) {
    const typeMatch = block.match(/^(\w+)\s*\{/);
    if (!typeMatch) continue;
    const entry: Record<string, string> = { _type: typeMatch[1].toLowerCase() };
    const fieldRe = /(\w+)\s*=\s*(\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|([^,\n]+))/g;
    let m: RegExpExecArray | null;
    while ((m = fieldRe.exec(block)) !== null) {
      const key = m[1].toLowerCase();
      const val = (m[3] ?? m[4] ?? m[5] ?? "").trim().replace(/\s+/g, " ");
      entry[key] = val;
    }
    entries.push(entry);
  }
  return entries;
}

/**
 * Days spent in each stage, from stage_history. The paper is still in the
 * stage of the last entry, so that stage runs until `now`, not until the row
 * was last touched. Time "in" published is not a waiting time and is skipped.
 */
export function daysPerStage(
  history: unknown,
  now: number = Date.now(),
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const entries = normalizeHistory(history);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.to === "published") continue;
    const start = new Date(entry.at).getTime();
    const end = i + 1 < entries.length ? new Date(entries[i + 1].at).getTime() : now;
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const days = Math.max(0, (end - start) / (24 * 60 * 60 * 1000));
    (out[entry.to] ??= []).push(days);
  }
  return out;
}
