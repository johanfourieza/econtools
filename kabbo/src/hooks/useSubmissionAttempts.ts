/**
 * useSubmissionAttempts – the journal-by-journal history of every paper
 * (`submission_attempts` table). One row per journal a paper was sent to; a
 * rejection closes the row and leaves the paper in place.
 *
 * `syncWithStage` keeps the record consistent with drag-and-drop moves so a
 * user who never opens the history still accumulates one: dragging a card to
 * Submitted with an intended journal set opens an attempt, dragging to R&R or
 * Accepted records that decision on the open attempt, and so on.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  isOpenDecision,
  type Decision,
} from '../../supabase/functions/_shared/pipeline';

export type { Decision };

export interface SubmissionAttempt {
  id: string;
  publicationId: string;
  journal: string;
  submittedAt: string; // YYYY-MM-DD
  manuscriptNumber: string | null;
  decision: Decision;
  decisionAt: string | null; // YYYY-MM-DD
  rounds: number;
  notes: string | null;
  createdAt: string;
}

export interface NewAttempt {
  publicationId: string;
  journal: string;
  submittedAt?: string;
  manuscriptNumber?: string;
}

export interface AttemptPatch {
  journal?: string;
  submittedAt?: string;
  manuscriptNumber?: string | null;
  decision?: Decision;
  decisionAt?: string | null;
  rounds?: number;
  notes?: string | null;
}

const SELECT = 'id, publication_id, journal, submitted_at, manuscript_number, decision, decision_at, rounds, notes, created_at';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function rowToLocal(r: any): SubmissionAttempt {
  return {
    id: r.id,
    publicationId: r.publication_id,
    journal: r.journal ?? '',
    submittedAt: r.submitted_at,
    manuscriptNumber: r.manuscript_number ?? null,
    decision: (r.decision ?? 'pending') as Decision,
    decisionAt: r.decision_at ?? null,
    rounds: r.rounds ?? 0,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  };
}

function patchToDb(patch: AttemptPatch): Record<string, unknown> {
  const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.journal !== undefined) db.journal = patch.journal.trim();
  if (patch.submittedAt !== undefined) db.submitted_at = patch.submittedAt;
  if (patch.manuscriptNumber !== undefined) db.manuscript_number = patch.manuscriptNumber?.trim() || null;
  if (patch.decision !== undefined) db.decision = patch.decision;
  if (patch.decisionAt !== undefined) db.decision_at = patch.decisionAt || null;
  if (patch.rounds !== undefined) db.rounds = patch.rounds;
  if (patch.notes !== undefined) db.notes = patch.notes?.trim() || null;
  return db;
}

/** The attempt still live at a journal, if any (pending or R&R). */
export function openAttempt(attempts: SubmissionAttempt[] | undefined): SubmissionAttempt | undefined {
  return (attempts ?? []).find(a => isOpenDecision(a.decision));
}

export function useSubmissionAttempts(userId?: string) {
  const [attempts, setAttempts] = useState<SubmissionAttempt[]>([]);

  const refetch = useCallback(async () => {
    if (!userId) {
      setAttempts([]);
      return;
    }
    const { data, error } = await supabase
      .from('submission_attempts')
      .select(SELECT)
      .order('submitted_at', { ascending: false });
    if (!error && data) setAttempts(data.map(rowToLocal));
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addAttempt = useCallback(async (input: NewAttempt): Promise<SubmissionAttempt | null> => {
    if (!userId || !input.journal.trim()) return null;
    const { data, error } = await supabase
      .from('submission_attempts')
      .insert({
        user_id: userId,
        publication_id: input.publicationId,
        journal: input.journal.trim(),
        submitted_at: input.submittedAt || todayIso(),
        manuscript_number: input.manuscriptNumber?.trim() || null,
      })
      .select(SELECT)
      .single();
    if (error || !data) {
      console.error('addAttempt failed:', error);
      return null;
    }
    const row = rowToLocal(data);
    setAttempts(prev => [row, ...prev]);
    return row;
  }, [userId]);

  const updateAttempt = useCallback(async (id: string, patch: AttemptPatch): Promise<boolean> => {
    const db = patchToDb(patch);
    // Optimistic
    setAttempts(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
    const { error } = await supabase.from('submission_attempts').update(db).eq('id', id);
    if (error) {
      console.error('updateAttempt failed:', error);
      refetch();
      return false;
    }
    return true;
  }, [refetch]);

  const deleteAttempt = useCallback(async (id: string): Promise<boolean> => {
    setAttempts(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase.from('submission_attempts').delete().eq('id', id);
    if (error) {
      console.error('deleteAttempt failed:', error);
      refetch();
      return false;
    }
    return true;
  }, [refetch]);

  const byPublication = useMemo(() => {
    const map = new Map<string, SubmissionAttempt[]>();
    for (const a of attempts) {
      const list = map.get(a.publicationId) ?? [];
      list.push(a);
      map.set(a.publicationId, list);
    }
    return map;
  }, [attempts]);

  /**
   * Keep the journal history consistent with a stage move made on the board.
   * Returns a one-line note for a toast, or null when nothing was recorded.
   */
  const syncWithStage = useCallback(async (
    publicationId: string,
    newStage: string,
    journalHint: string,
  ): Promise<string | null> => {
    const list = byPublication.get(publicationId) ?? [];
    const open = openAttempt(list);
    const today = todayIso();

    if (newStage === 'submitted') {
      if (open) return null;
      const journal = journalHint.trim();
      if (!journal) return null;
      const row = await addAttempt({ publicationId, journal, submittedAt: today });
      return row ? `Submission to ${journal} recorded` : null;
    }
    if (newStage === 'revise_resubmit') {
      if (!open || open.decision !== 'pending') return null;
      await updateAttempt(open.id, { decision: 'revise_resubmit', decisionAt: today });
      return `Revise & resubmit at ${open.journal} recorded`;
    }
    if (newStage === 'resubmitted') {
      if (!open || open.decision !== 'revise_resubmit') return null;
      await updateAttempt(open.id, { decision: 'pending', decisionAt: null, rounds: open.rounds + 1 });
      return `Round ${open.rounds + 1} at ${open.journal} recorded`;
    }
    if (newStage === 'accepted') {
      if (!open) return null;
      await updateAttempt(open.id, { decision: 'accept', decisionAt: today });
      return `Acceptance at ${open.journal} recorded`;
    }
    return null;
  }, [byPublication, addAttempt, updateAttempt]);

  return { attempts, byPublication, refetch, addAttempt, updateAttempt, deleteAttempt, syncWithStage };
}
