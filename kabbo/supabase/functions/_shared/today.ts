// The "Today" queue: the short list of things that need the researcher's own
// attention. One rule set, used by the web app (src/hooks/useToday.ts) and by
// the MCP `get_today` tool, so an agent and the dashboard always agree.
//
// Design rules (from the September 2026 plan):
// - At most a handful of items; nothing nags about papers that are waiting on
//   a journal, only about things the researcher can act on.
// - Ideas never nag. Drafts nag only after a long silence.
// - Every item points at one card (or one reminder) and says what to do.

import { normalizeHistory, type HistoryEntry } from "./pipeline.ts";

export interface TodayPublication {
  id: string;
  title: string;
  stage: string;
  updatedAt: string;
  history: HistoryEntry[] | unknown;
  /** true when the paper is published but has no year recorded */
  missingYear?: boolean;
  /** active (default) | paused | shelved. Paused and shelved papers never nag. */
  disposition?: string | null;
  /** ISO date on which a paused/shelved paper should be looked at again */
  reconsiderAt?: string | null;
}

export interface TodayReminder {
  id: string;
  publicationId: string | null;
  title: string;
  dueDate: string;
  isCompleted: boolean;
}

export type TodayKind =
  | "reminder_overdue"
  | "reminder_due"
  | "revision_waiting"
  | "no_decision"
  | "accepted_check"
  | "draft_idle"
  | "reconsider"
  | "missing_year";

export interface TodayItem {
  /** stable key, e.g. "reminder:<id>" or "revision_waiting:<pubId>" */
  id: string;
  kind: TodayKind;
  message: string;
  detail?: string;
  publicationId: string | null;
  reminderId?: string;
  /** higher = shown first */
  priority: number;
}

export const TODAY_THRESHOLDS = {
  reminderDueSoonDays: 7,
  revisionWaitingDays: 14,
  noDecisionDays: 120,
  acceptedCheckDays: 60,
  draftIdleDays: 90,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  draft: "Draft",
  submitted: "Submitted",
  revise_resubmit: "Revise & Resubmit",
  resubmitted: "Resubmitted",
  accepted: "Accepted",
  published: "Published",
};

function quote(title: string): string {
  const t = (title || "").trim();
  return t ? `"${t}"` : "an untitled paper";
}

/** Most recent stage transition, else the row's updated_at. */
export function lastActivityAt(pub: TodayPublication): number | null {
  const history = normalizeHistory(pub.history);
  const last = history[history.length - 1];
  if (last?.at) {
    const ts = new Date(last.at).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  const ts = new Date(pub.updatedAt).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function daysSince(ts: number, now: number): number {
  return Math.floor((now - ts) / DAY_MS);
}

function dueLabel(daysUntil: number): string {
  if (daysUntil <= 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}

export function computeToday(
  publications: TodayPublication[],
  reminders: TodayReminder[],
  now: number = Date.now(),
): TodayItem[] {
  const items: TodayItem[] = [];
  const titleById = new Map(publications.map((p) => [p.id, p.title]));
  const T = TODAY_THRESHOLDS;

  // ── reminders ─────────────────────────────────────────────────────────
  for (const r of reminders) {
    if (r.isCompleted) continue;
    const due = new Date(r.dueDate).getTime();
    if (Number.isNaN(due)) continue;
    const paper = r.publicationId ? titleById.get(r.publicationId) : undefined;
    const daysUntil = Math.ceil((due - now) / DAY_MS);
    if (daysUntil < 0) {
      const overdue = -daysUntil;
      items.push({
        id: `reminder:${r.id}`,
        kind: "reminder_overdue",
        message: `Overdue: ${r.title}`,
        detail: `${overdue} day${overdue === 1 ? "" : "s"} overdue${paper ? ` · ${paper}` : ""}`,
        publicationId: r.publicationId,
        reminderId: r.id,
        priority: 1000 + Math.min(overdue, 365),
      });
    } else if (daysUntil <= T.reminderDueSoonDays) {
      items.push({
        id: `reminder:${r.id}`,
        kind: "reminder_due",
        message: `Due ${dueLabel(daysUntil)}: ${r.title}`,
        detail: paper,
        publicationId: r.publicationId,
        reminderId: r.id,
        priority: 800 + (T.reminderDueSoonDays - daysUntil),
      });
    }
  }

  // ── papers ────────────────────────────────────────────────────────────
  let missingYear = 0;
  for (const p of publications) {
    if (p.stage === "published") {
      if (p.missingYear) missingYear++;
      continue;
    }
    // A resting paper is silent until its reconsider date, then asks once.
    if (p.disposition === "paused" || p.disposition === "shelved") {
      if (p.reconsiderAt) {
        const due = new Date(p.reconsiderAt).getTime();
        if (!Number.isNaN(due) && due <= now) {
          items.push({
            id: `reconsider:${p.id}`,
            kind: "reconsider",
            message: `Reconsider ${quote(p.title)}`,
            detail: `${p.disposition === "paused" ? "Paused" : "Shelved"}; you asked to look at it again. Pick it up or shelve it for good.`,
            publicationId: p.id,
            priority: 600,
          });
        }
      }
      continue;
    }
    if (p.stage === "idea") continue;
    const ts = lastActivityAt(p);
    if (ts == null) continue;
    const days = daysSince(ts, now);

    if (p.stage === "revise_resubmit" && days >= T.revisionWaitingDays) {
      items.push({
        id: `revision_waiting:${p.id}`,
        kind: "revision_waiting",
        message: `Revision waiting: ${quote(p.title)}`,
        detail: `In ${STAGE_LABELS.revise_resubmit} for ${days} days`,
        publicationId: p.id,
        priority: 700 + Math.min(days, 365),
      });
    } else if ((p.stage === "submitted" || p.stage === "resubmitted") && days >= T.noDecisionDays) {
      items.push({
        id: `no_decision:${p.id}`,
        kind: "no_decision",
        message: `No decision yet on ${quote(p.title)}`,
        detail: `${STAGE_LABELS[p.stage]} ${days} days ago. Chase the editor?`,
        publicationId: p.id,
        priority: 500 + Math.min(days, 365),
      });
    } else if (p.stage === "accepted" && days >= T.acceptedCheckDays) {
      items.push({
        id: `accepted_check:${p.id}`,
        kind: "accepted_check",
        message: `Is ${quote(p.title)} out yet?`,
        detail: `Accepted ${days} days ago. If it has appeared, file it under Published.`,
        publicationId: p.id,
        priority: 400 + Math.min(days, 365),
      });
    } else if (p.stage === "draft" && days >= T.draftIdleDays) {
      items.push({
        id: `draft_idle:${p.id}`,
        kind: "draft_idle",
        message: `${quote(p.title)} has not moved in ${days} days`,
        detail: "Still a live draft? If not, shelve it.",
        publicationId: p.id,
        priority: 300 + Math.min(days, 365),
      });
    }
  }

  if (missingYear > 0) {
    items.push({
      id: "missing_year",
      kind: "missing_year",
      message: missingYear === 1
        ? "1 published paper has no year"
        : `${missingYear} published papers have no year`,
      detail: "Open the Year unknown column and add them.",
      publicationId: null,
      priority: 200,
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}
