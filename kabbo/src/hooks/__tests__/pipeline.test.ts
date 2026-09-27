import { describe, it, expect } from 'vitest';
import {
  normalizeStage,
  stageIndex,
  appendStageHistory,
  normalizeHistory,
  isStageVisible,
  normalizeReminderType,
  REMINDER_TYPES,
  parseBibtex,
  daysPerStage,
} from '../../../supabase/functions/_shared/pipeline';

describe('normalizeStage', () => {
  it('accepts canonical stages and common aliases', () => {
    expect(normalizeStage('submitted')).toBe('submitted');
    expect(normalizeStage('R&R')).toBe('revise_resubmit');
    expect(normalizeStage(' Forthcoming ')).toBe('accepted');
    expect(normalizeStage('wip')).toBe('draft');
    expect(normalizeStage('in-review')).toBe('submitted');
  });
  it('returns null for unknown input', () => {
    expect(normalizeStage('rejected')).toBeNull();
    expect(normalizeStage('')).toBeNull();
    expect(normalizeStage(undefined)).toBeNull();
  });
});

describe('stageIndex / isStageVisible', () => {
  it('orders stages like get_stage_index in Postgres', () => {
    expect(stageIndex('idea')).toBe(0);
    expect(stageIndex('published')).toBe(6);
    expect(stageIndex('nope')).toBe(-1);
  });
  it('hides stages below the owner minimum and shows the rest', () => {
    expect(isStageVisible('idea', 'submitted')).toBe(false);
    expect(isStageVisible('draft', 'submitted')).toBe(false);
    expect(isStageVisible('submitted', 'submitted')).toBe(true);
    expect(isStageVisible('published', 'submitted')).toBe(true);
  });
  it('treats a missing setting as everything visible', () => {
    expect(isStageVisible('idea', null)).toBe(true);
    expect(isStageVisible('idea', undefined)).toBe(true);
  });
  it('never shows a row whose stage is unknown', () => {
    expect(isStageVisible('garbage', 'idea')).toBe(false);
  });
});

describe('appendStageHistory', () => {
  it('appends a {from,to,at} entry on a real move', () => {
    const next = appendStageHistory([], 'draft', 'submitted', '2026-09-27T00:00:00.000Z');
    expect(next).toEqual([{ from: 'draft', to: 'submitted', at: '2026-09-27T00:00:00.000Z' }]);
  });
  it('is a no-op when the stage did not change or from is unknown', () => {
    const h = [{ from: 'idea', to: 'draft', at: 'x' }];
    expect(appendStageHistory(h, 'draft', 'draft')).toEqual(h);
    expect(appendStageHistory(h, null, 'draft')).toEqual(h);
  });
  it('drops malformed entries from a raw column', () => {
    expect(normalizeHistory([null, 'junk', { to: 'draft', at: 'x', from: 'idea' }])).toEqual([
      { from: 'idea', to: 'draft', at: 'x' },
    ]);
    expect(normalizeHistory(null)).toEqual([]);
  });
});

describe('normalizeReminderType', () => {
  it('only ever returns a value the CHECK constraint accepts', () => {
    for (const input of ['custom', 'conference_deadline', 'review_response', 'grant_report', 'nonsense', '', undefined]) {
      expect(REMINDER_TYPES).toContain(normalizeReminderType(input));
    }
  });
  it('maps the aliases the old MCP schema advertised', () => {
    expect(normalizeReminderType('conference_deadline')).toBe('conference');
    expect(normalizeReminderType('review_response')).toBe('resubmission');
    expect(normalizeReminderType('custom')).toBe('general');
    expect(normalizeReminderType('Working Paper')).toBe('working_paper');
  });
});

describe('parseBibtex', () => {
  it('reads title, author, year and journal from a braced entry', () => {
    const [e] = parseBibtex('@article{key, title = {A {Nested} Title}, author = {A and B}, year = {2024}, journal = {QJE}}');
    expect(e._type).toBe('article');
    expect(e.title).toBe('A {Nested} Title');
    expect(e.author).toBe('A and B');
    expect(e.year).toBe('2024');
    expect(e.journal).toBe('QJE');
  });
  it('handles several entries and quoted values', () => {
    const entries = parseBibtex('@book{a, title = "One"}\n@incollection{b, title = "Two"}');
    expect(entries.map((e) => e._type)).toEqual(['book', 'incollection']);
    expect(entries.map((e) => e.title)).toEqual(['One', 'Two']);
  });
});

describe('daysPerStage', () => {
  const day = 24 * 60 * 60 * 1000;
  const t0 = Date.parse('2026-01-01T00:00:00.000Z');
  it('measures the current stage up to now, not up to the last edit', () => {
    const history = [
      { from: 'idea', to: 'draft', at: new Date(t0).toISOString() },
      { from: 'draft', to: 'submitted', at: new Date(t0 + 10 * day).toISOString() },
    ];
    const out = daysPerStage(history, t0 + 40 * day);
    expect(out.draft[0]).toBeCloseTo(10, 5);
    expect(out.submitted[0]).toBeCloseTo(30, 5);
  });
  it('does not count time sitting in published', () => {
    const history = [
      { from: 'accepted', to: 'published', at: new Date(t0).toISOString() },
    ];
    expect(daysPerStage(history, t0 + 100 * day)).toEqual({});
  });
});
