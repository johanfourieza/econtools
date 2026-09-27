import { describe, it, expect } from 'vitest';
import {
  computeToday,
  TODAY_THRESHOLDS,
  type TodayPublication,
  type TodayReminder,
} from '../../../supabase/functions/_shared/today';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-27T09:00:00.000Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const ahead = (days: number) => new Date(NOW + days * DAY).toISOString();

function pub(over: Partial<TodayPublication> & { id: string }): TodayPublication {
  return { title: `Paper ${over.id}`, stage: 'draft', updatedAt: ago(0), history: [], ...over };
}

function rem(over: Partial<TodayReminder> & { id: string }): TodayReminder {
  return { publicationId: null, title: `Reminder ${over.id}`, dueDate: ahead(1), isCompleted: false, ...over };
}

describe('computeToday – reminders', () => {
  it('flags overdue reminders first, then those due within a week', () => {
    const items = computeToday(
      [pub({ id: 'p1', title: 'Climate paper' })],
      [
        rem({ id: 'r1', dueDate: ago(3), publicationId: 'p1' }),
        rem({ id: 'r2', dueDate: ahead(2) }),
        rem({ id: 'r3', dueDate: ahead(30) }),
        rem({ id: 'r4', dueDate: ago(10), isCompleted: true }),
      ],
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['reminder:r1', 'reminder:r2']);
    expect(items[0].kind).toBe('reminder_overdue');
    expect(items[0].detail).toContain('Climate paper');
    expect(items[1].kind).toBe('reminder_due');
    expect(items[1].message).toMatch(/^Due in 2 days/);
  });
});

describe('computeToday – papers', () => {
  it('never nags about ideas or about papers under review inside the window', () => {
    const items = computeToday(
      [
        pub({ id: 'idea', stage: 'idea', updatedAt: ago(400) }),
        pub({ id: 'sub', stage: 'submitted', updatedAt: ago(TODAY_THRESHOLDS.noDecisionDays - 1) }),
        pub({ id: 'draft', stage: 'draft', updatedAt: ago(TODAY_THRESHOLDS.draftIdleDays - 1) }),
      ],
      [],
      NOW,
    );
    expect(items).toEqual([]);
  });

  it('asks about a revision after two weeks and a decision after four months', () => {
    const items = computeToday(
      [
        pub({ id: 'rr', stage: 'revise_resubmit', updatedAt: ago(20) }),
        pub({ id: 'sub', stage: 'resubmitted', updatedAt: ago(150) }),
      ],
      [],
      NOW,
    );
    expect(items.map((i) => i.kind)).toEqual(['revision_waiting', 'no_decision']);
    expect(items[0].detail).toContain('20 days');
  });

  it('uses the last stage transition, not updated_at, as the clock', () => {
    const items = computeToday(
      [pub({
        id: 'rr',
        stage: 'revise_resubmit',
        updatedAt: ago(0), // edited today
        history: [{ from: 'submitted', to: 'revise_resubmit', at: ago(30) }],
      })],
      [],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].detail).toContain('30 days');
  });

  it('checks on accepted papers only after a while, and nags idle drafts late', () => {
    const items = computeToday(
      [
        pub({ id: 'acc', stage: 'accepted', updatedAt: ago(TODAY_THRESHOLDS.acceptedCheckDays) }),
        pub({ id: 'fresh', stage: 'accepted', updatedAt: ago(5) }),
        pub({ id: 'old', stage: 'draft', updatedAt: ago(TODAY_THRESHOLDS.draftIdleDays) }),
      ],
      [],
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['accepted_check:acc', 'draft_idle:old']);
  });

  it('leaves paused and shelved papers alone until their reconsider date', () => {
    const items = computeToday(
      [
        pub({ id: 'p', stage: 'draft', updatedAt: ago(400), disposition: 'paused' }),
        pub({ id: 's', stage: 'revise_resubmit', updatedAt: ago(400), disposition: 'shelved', reconsiderAt: ahead(10) }),
        pub({ id: 'r', stage: 'draft', updatedAt: ago(400), disposition: 'shelved', reconsiderAt: ago(1) }),
      ],
      [],
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['reconsider:r']);
    expect(items[0].kind).toBe('reconsider');
  });

  it('rolls published papers without a year into one item', () => {
    const items = computeToday(
      [
        pub({ id: 'a', stage: 'published', missingYear: true }),
        pub({ id: 'b', stage: 'published', missingYear: true }),
        pub({ id: 'c', stage: 'published' }),
      ],
      [],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe('2 published papers have no year');
    expect(items[0].publicationId).toBeNull();
  });

  it('sorts by priority: overdue reminder, revision, due-soon reminder, decision', () => {
    const items = computeToday(
      [
        pub({ id: 'rr', stage: 'revise_resubmit', updatedAt: ago(20) }),
        pub({ id: 'sub', stage: 'submitted', updatedAt: ago(200) }),
      ],
      [rem({ id: 'o', dueDate: ago(1) }), rem({ id: 'd', dueDate: ahead(3) })],
      NOW,
    );
    expect(items.map((i) => i.kind)).toEqual([
      'reminder_overdue', 'reminder_due', 'revision_waiting', 'no_decision',
    ]);
  });
});
