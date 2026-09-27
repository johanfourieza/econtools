/**
 * useToday – the dashboard's short attention list, computed from data already
 * loaded (publications + open reminders). The rules live in
 * supabase/functions/_shared/today.ts so the MCP `get_today` tool returns the
 * same list an agent would see here.
 */

import { useMemo } from 'react';
import { Publication } from '@/types/publication';
import { computeToday, type TodayItem, type TodayPublication, type TodayReminder } from '../../supabase/functions/_shared/today';
import type { ReminderRow } from './useReminders';

export type { TodayItem };

export function useToday(publications: Publication[], reminders: ReminderRow[]): TodayItem[] {
  return useMemo(() => {
    const pubs: TodayPublication[] = publications
      // Only papers the user owns: shared papers are someone else's to-do.
      .filter(p => !p.isCollaboration)
      .map(p => ({
        id: p.id,
        title: p.title,
        stage: p.stageId,
        updatedAt: p.updatedAt,
        history: p.history,
        missingYear: p.stageId === 'published' && p.publishedYear === 'unknown',
        disposition: p.disposition ?? 'active',
        reconsiderAt: p.dispositionReconsiderAt || null,
      }));
    const rems: TodayReminder[] = reminders.map(r => ({
      id: r.id,
      publicationId: r.publicationId,
      title: r.title,
      dueDate: r.dueDate,
      isCompleted: r.isCompleted,
    }));
    return computeToday(pubs, rems);
  }, [publications, reminders]);
}
