/**
 * useInsights – rule-based dashboard insights for Kabbo.
 *
 * Pure rule engine (`computeInsights`) over the `publications` array returned
 * by `useSupabasePublications`, plus a React hook that manages per-card
 * dismissal state (7-day TTL) and the expand/collapse state of the panel.
 *
 * All rules run client-side from data already loaded – no new Supabase fetch.
 * The async co-authors-on-Kabbo insight is layered on in `InsightsPanel` via
 * the separate `useCoauthorMatchInsight` hook.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Publication } from '@/types/publication';
import { parseList } from '@/lib/storage';
import { pickKabboQuote } from '@/data/kabboQuotes';

export type InsightCategory =
  | 'celebration'
  | 'quick_wins'
  | 'stalled'
  | 'missing_year'
  | 'missing_journal'
  | 'journals'
  | 'pipeline_gap'
  | 'theme_focus'
  | 'network'
  | 'momentum';

export interface Insight {
  id: string;              // stable dismissal key, e.g. "stalled:abc123"
  category: InsightCategory;
  message: string;         // one-line primary text
  detail?: string;         // optional second line (e.g. ǀkabbo quote)
  priority: number;        // higher = shown first
}

// ── constants ────────────────────────────────────────────────────────────
const DISMISSED_KEY = 'kabbo_insights_dismissed';
const EXPANDED_KEY = 'kabbo_insights_expanded';
const DAY_MS = 24 * 60 * 60 * 1000;
const DISMISSAL_TTL_MS = 7 * DAY_MS;
const STALLED_DAYS = 30;
const CELEBRATION_DAYS = 7;
const RECENT_SUBMIT_DAYS = 365;

// ── helpers ──────────────────────────────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  idea: 'Idea',
  draft: 'Drafting',
  submitted: 'Submitted',
  revise_resubmit: 'Revise & Resubmit',
  resubmitted: 'Resubmitted',
  accepted: 'Accepted',
  published: 'Published',
};

function stageLabel(stageId: string): string {
  return STAGE_LABELS[stageId] || stageId;
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / DAY_MS);
}

function lastPublishedTransitionAt(pub: Publication): number | null {
  // Search history in reverse for the most recent "→ published" transition.
  for (let i = pub.history.length - 1; i >= 0; i--) {
    const h = pub.history[i];
    if (h.to === 'published' && h.at) {
      const ts = new Date(h.at).getTime();
      if (!isNaN(ts)) return ts;
    }
  }
  return null;
}

function lastActivityAt(pub: Publication): number | null {
  if (pub.history.length > 0) {
    const last = pub.history[pub.history.length - 1];
    if (last.at) {
      const ts = new Date(last.at).getTime();
      if (!isNaN(ts)) return ts;
    }
  }
  const updatedTs = new Date(pub.updatedAt).getTime();
  return isNaN(updatedTs) ? null : updatedTs;
}

function submittedRecently(pub: Publication, cutoffMs: number): boolean {
  return pub.history.some(h => {
    if (h.to !== 'submitted') return false;
    const ts = new Date(h.at).getTime();
    return !isNaN(ts) && ts >= cutoffMs;
  });
}

// ── pure rule engine ─────────────────────────────────────────────────────

/**
 * Compute all active insights from the current publications array.
 *
 * Pure – no localStorage, no React, no side effects. `now` is injectable
 * for deterministic testing.
 */
export function computeInsights(
  publications: Publication[],
  now: number = Date.now(),
): Insight[] {
  const results: Insight[] = [];
  const nowDate = new Date(now);
  const thisYear = nowDate.getFullYear();
  const lastYear = thisYear - 1;
  const thisDayOfYear = dayOfYear(nowDate);
  const recentSubmitCutoff = now - RECENT_SUBMIT_DAYS * DAY_MS;

  // ── celebration (highest priority) ────────────────────────────────────
  for (const pub of publications) {
    if (pub.stageId !== 'published') continue;
    const ts = lastPublishedTransitionAt(pub);
    if (ts == null) continue;
    const daysSince = (now - ts) / DAY_MS;
    if (daysSince >= 0 && daysSince < CELEBRATION_DAYS) {
      results.push({
        id: `celebration:${pub.id}`,
        category: 'celebration',
        message: `You published "${pub.title || 'Untitled'}" this week!`,
        detail: `${pickKabboQuote().text} – ǀkabbo`,
        priority: 1000,
      });
    }
  }

  // ── quick_wins – accepted but not yet marked published ────────────────
  const acceptedCount = publications.filter(p => p.stageId === 'accepted').length;
  if (acceptedCount > 0) {
    results.push({
      id: 'quick_wins',
      category: 'quick_wins',
      message: acceptedCount === 1
        ? '1 accepted paper – ready to mark Published?'
        : `${acceptedCount} accepted papers – ready to mark Published?`,
      priority: 500,
    });
  }

  // ── pipeline_gap – drafts piling up with nothing submitted recently ──
  const draftCount = publications.filter(p => p.stageId === 'draft').length;
  const submittedRecentlyCount = publications.filter(p =>
    submittedRecently(p, recentSubmitCutoff),
  ).length;
  if (draftCount >= 3 && submittedRecentlyCount === 0) {
    results.push({
      id: 'pipeline_gap',
      category: 'pipeline_gap',
      message: `${draftCount} papers in draft but none submitted in the last 12 months`,
      detail: 'Time to ship one?',
      priority: 450,
    });
  }

  // ── stalled – cards not moved in 30+ days ─────────────────────────────
  for (const pub of publications) {
    if (pub.stageId === 'published' || pub.stageId === 'accepted') continue;
    const ts = lastActivityAt(pub);
    if (ts == null) continue;
    const daysSince = Math.floor((now - ts) / DAY_MS);
    if (daysSince >= STALLED_DAYS) {
      results.push({
        id: `stalled:${pub.id}`,
        category: 'stalled',
        message: `"${pub.title || 'Untitled'}" has been in ${stageLabel(pub.stageId)} for ${daysSince} days`,
        priority: 400 + Math.min(daysSince, 365),
      });
    }
  }

  // ── journals – distinct target journals submitted to in last 12 mo ───
  const journalSet = new Set<string>();
  for (const pub of publications) {
    if (pub.outputType !== 'journal') continue;
    if (!submittedRecently(pub, recentSubmitCutoff)) continue;
    const journal = (pub.typeA || '').trim();
    if (journal) journalSet.add(journal.toLowerCase());
  }
  if (journalSet.size >= 2) {
    results.push({
      id: `journals:${thisYear}`,
      category: 'journals',
      message: `You've submitted to ${journalSet.size} different journals in the last 12 months`,
      priority: 350,
    });
  }

  // ── missing_year – published rows with no target_year ─────────────────
  const missingYearCount = publications.filter(
    p => p.stageId === 'published' && p.publishedYear === 'unknown',
  ).length;
  if (missingYearCount > 0) {
    results.push({
      id: 'missing_year',
      category: 'missing_year',
      message: missingYearCount === 1
        ? '1 published paper has no year yet'
        : `${missingYearCount} published papers have no year yet`,
      priority: 300,
    });
  }

  // ── theme_focus – dominant theme among this year's publications ──────
  const thisYearPublished = publications.filter(p => {
    if (p.stageId !== 'published') return false;
    return typeof p.publishedYear === 'number' && p.publishedYear === thisYear;
  });
  if (thisYearPublished.length >= 2) {
    const themeCounts = new Map<string, number>();
    for (const pub of thisYearPublished) {
      for (const t of parseList(pub.themes)) {
        themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
      }
    }
    const top = [...themeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      results.push({
        id: `theme_focus:${thisYear}`,
        category: 'theme_focus',
        message: `${top[1]} of this year's papers are in "${top[0]}"`,
        priority: 250,
      });
    }
  }

  // ── missing_journal – submitted-ish papers with no target journal ────
  const missingJournalCount = publications.filter(p =>
    p.outputType === 'journal' &&
    (p.stageId === 'submitted' || p.stageId === 'revise_resubmit' || p.stageId === 'resubmitted') &&
    !(p.typeA ?? '').trim(),
  ).length;
  if (missingJournalCount > 0) {
    results.push({
      id: 'missing_journal',
      category: 'missing_journal',
      message: missingJournalCount === 1
        ? '1 submitted paper has no target journal set'
        : `${missingJournalCount} submitted papers have no target journal set`,
      priority: 200,
    });
  }

  // ── momentum – YTD published count vs same date last year ─────────────
  let publishedThisYear = 0;
  let publishedLastYearByNow = 0;
  for (const pub of publications) {
    if (pub.stageId !== 'published') continue;
    const ts = lastPublishedTransitionAt(pub);
    if (ts == null) continue;
    const d = new Date(ts);
    if (d.getFullYear() === thisYear) {
      publishedThisYear++;
    } else if (d.getFullYear() === lastYear && dayOfYear(d) <= thisDayOfYear) {
      publishedLastYearByNow++;
    }
  }
  if (publishedThisYear > 0 || publishedLastYearByNow > 0) {
    const delta = publishedThisYear - publishedLastYearByNow;
    let message: string;
    if (delta > 0) {
      message = `You've published ${publishedThisYear} so far this year – up from ${publishedLastYearByNow} at this point last year`;
    } else if (delta < 0) {
      message = `You've published ${publishedThisYear} so far this year – down from ${publishedLastYearByNow} at this point last year`;
    } else {
      message = `You've published ${publishedThisYear} so far this year – same as this point last year`;
    }
    results.push({
      id: `momentum:${thisYear}`,
      category: 'momentum',
      message,
      priority: 100,
    });
  }

  return results.sort((a, b) => b.priority - a.priority);
}

// ── localStorage helpers ─────────────────────────────────────────────────
function readDismissals(now: number): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const fresh: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && now - ts < DISMISSAL_TTL_MS) fresh[k] = ts;
    }
    // Prune stale entries so the map doesn't grow forever.
    if (Object.keys(fresh).length !== Object.keys(parsed).length) {
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(fresh)); } catch { /* quota */ }
    }
    return fresh;
  } catch {
    return {};
  }
}

function writeDismissals(map: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch { /* quota – accept loss of persistence */ }
}

function readInitialExpanded(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(EXPANDED_KEY);
  if (stored !== null) return stored === 'true';
  // Default: collapsed on mobile, expanded on desktop.
  if (window.matchMedia) {
    return !window.matchMedia('(max-width: 767px)').matches;
  }
  return true;
}

// ── React hook ───────────────────────────────────────────────────────────
export function useInsights(publications: Publication[]): {
  insights: Insight[];
  dismiss: (id: string) => void;
  isExpanded: boolean;
  toggleExpanded: () => void;
} {
  const [dismissed, setDismissed] = useState<Record<string, number>>(() =>
    readDismissals(Date.now()),
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(readInitialExpanded);

  // Re-read dismissals on mount so stale TTL entries get pruned on app load
  // even if the module was imported before the user's session began.
  useEffect(() => {
    setDismissed(readDismissals(Date.now()));
  }, []);

  const allInsights = useMemo(() => computeInsights(publications), [publications]);

  const insights = useMemo(
    () => allInsights.filter(i => !(i.id in dismissed)),
    [allInsights, dismissed],
  );

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = { ...prev, [id]: Date.now() };
      writeDismissals(next);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(EXPANDED_KEY, String(next)); } catch { /* quota */ }
      }
      return next;
    });
  }, []);

  return { insights, dismiss, isExpanded, toggleExpanded };
}
