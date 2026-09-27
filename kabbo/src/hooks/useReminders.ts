/**
 * useReminders – the user's open reminders, from the `reminders` table.
 *
 * RLS scopes rows to auth.uid(), so the queries carry no user filter. The
 * hook keeps one in-memory list (soonest first), exposes CRUD, and provides a
 * small context so cards can show a due indicator without prop drilling.
 */

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ReminderType } from '../../supabase/functions/_shared/pipeline';

export interface ReminderRow {
  id: string;
  publicationId: string | null;
  title: string;
  description: string | null;
  dueDate: string;
  reminderType: ReminderType;
  isCompleted: boolean;
  createdAt: string;
}

export interface NewReminder {
  publicationId?: string | null;
  title: string;
  dueDate: string; // ISO date or datetime
  reminderType?: ReminderType;
  description?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DUE_SOON_DAYS = 7;

function rowToLocal(r: any): ReminderRow {
  return {
    id: r.id,
    publicationId: r.publication_id ?? null,
    title: r.title ?? '',
    description: r.description ?? null,
    dueDate: r.due_date,
    reminderType: (r.reminder_type ?? 'general') as ReminderType,
    isCompleted: !!r.is_completed,
    createdAt: r.created_at,
  };
}

export function useReminders(userId?: string) {
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!userId) {
      setReminders([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('reminders')
      .select('id, publication_id, title, description, due_date, reminder_type, is_completed, created_at')
      .eq('is_completed', false)
      .order('due_date', { ascending: true });
    if (!error && data) setReminders(data.map(rowToLocal));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addReminder = useCallback(async (input: NewReminder): Promise<ReminderRow | null> => {
    if (!userId) return null;
    const due = new Date(input.dueDate);
    if (!input.title.trim() || Number.isNaN(due.getTime())) return null;
    const { data, error } = await supabase
      .from('reminders')
      .insert({
        user_id: userId,
        publication_id: input.publicationId ?? null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        due_date: due.toISOString(),
        reminder_type: input.reminderType ?? 'general',
      })
      .select('id, publication_id, title, description, due_date, reminder_type, is_completed, created_at')
      .single();
    if (error || !data) {
      console.error('addReminder failed:', error);
      return null;
    }
    const row = rowToLocal(data);
    setReminders(prev => [...prev, row].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    return row;
  }, [userId]);

  const completeReminder = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('reminders').update({ is_completed: true }).eq('id', id);
    if (error) {
      console.error('completeReminder failed:', error);
      return false;
    }
    setReminders(prev => prev.filter(r => r.id !== id));
    return true;
  }, []);

  const deleteReminder = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) {
      console.error('deleteReminder failed:', error);
      return false;
    }
    setReminders(prev => prev.filter(r => r.id !== id));
    return true;
  }, []);

  const byPublication = useMemo(() => {
    const map = new Map<string, ReminderRow[]>();
    for (const r of reminders) {
      if (!r.publicationId) continue;
      const list = map.get(r.publicationId) ?? [];
      list.push(r);
      map.set(r.publicationId, list);
    }
    return map;
  }, [reminders]);

  return { reminders, loading, byPublication, refetch, addReminder, completeReminder, deleteReminder };
}

// ── context for the card indicator ─────────────────────────────────────
export type DueStatus = 'overdue' | 'due_soon' | null;

const RemindersContext = createContext<Map<string, ReminderRow[]>>(new Map());

export function RemindersProvider({ byPublication, children }: { byPublication: Map<string, ReminderRow[]>; children: ReactNode }) {
  return createElement(RemindersContext.Provider, { value: byPublication }, children);
}

/** Worst-case due status among a publication's open reminders. */
export function dueStatusFor(reminders: ReminderRow[] | undefined, now: number = Date.now()): DueStatus {
  if (!reminders || reminders.length === 0) return null;
  let status: DueStatus = null;
  for (const r of reminders) {
    const due = new Date(r.dueDate).getTime();
    if (Number.isNaN(due)) continue;
    if (due < now) return 'overdue';
    if (due - now <= DUE_SOON_DAYS * DAY_MS) status = 'due_soon';
  }
  return status;
}

export function useReminderStatus(publicationId: string): DueStatus {
  const map = useContext(RemindersContext);
  return dueStatusFor(map.get(publicationId));
}
