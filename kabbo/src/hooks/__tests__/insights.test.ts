/**
 * Tests for the rule engine in useInsights.
 *
 * Only `computeInsights` is tested here — it's a pure function. The hook-level
 * dismissal + expand state is trivial wrapping around localStorage and is
 * verified manually per TESTING.md.
 */

import { describe, expect, it } from 'vitest';
import { computeInsights } from '../useInsights';
import { Publication } from '@/types/publication';

// Deterministic "now" so date-based rules are reproducible across test runs.
const NOW = new Date('2026-04-21T12:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

function basePub(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'pub-1',
    ownerId: 'user-1',
    title: 'A Paper',
    authors: 'Smith, Jones',
    themes: '',
    grants: '',
    completionYear: '',
    stageId: 'idea',
    outputType: 'journal',
    typeA: '',
    typeB: '',
    typeC: '',
    workingPaper: { on: false, series: '', number: '', url: '' },
    notes: '',
    links: [],
    collaborationLinks: [],
    githubRepo: '',
    overleafLink: '',
    reminders: [],
    collaborators: [],
    publishedYear: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    history: [],
    ...overrides,
  };
}

describe('computeInsights · celebration', () => {
  it('fires for a publication moved to published within the last 7 days', () => {
    const pub = basePub({
      id: 'p1',
      title: 'Slavery Wages 1800',
      stageId: 'published',
      publishedYear: 2026,
      history: [{ from: 'accepted', to: 'published', at: daysAgo(3) }],
    });
    const insight = computeInsights([pub], NOW).find(i => i.category === 'celebration');
    expect(insight).toBeDefined();
    expect(insight?.id).toBe('celebration:p1');
    expect(insight?.message).toContain('Slavery Wages 1800');
    // Celebration cards always carry a ǀkabbo quote as the detail line.
    expect(insight?.detail).toMatch(/ǀkabbo/);
  });

  it('does not fire for a transition older than 7 days', () => {
    const pub = basePub({
      stageId: 'published',
      publishedYear: 2026,
      history: [{ from: 'accepted', to: 'published', at: daysAgo(8) }],
    });
    const insights = computeInsights([pub], NOW);
    expect(insights.find(i => i.category === 'celebration')).toBeUndefined();
  });

  it('does not fire for a published card with no history of the transition', () => {
    // e.g. a BibTeX import that landed directly in published without going
    // through the stage history — we have no timestamp to anchor on.
    const pub = basePub({
      stageId: 'published',
      publishedYear: 2024,
      history: [],
    });
    const insights = computeInsights([pub], NOW);
    expect(insights.find(i => i.category === 'celebration')).toBeUndefined();
  });
});

describe('computeInsights · stalled', () => {
  it('fires for a draft with no history and updatedAt > 30 days ago', () => {
    const pub = basePub({ stageId: 'draft', updatedAt: daysAgo(45) });
    const insight = computeInsights([pub], NOW).find(i => i.category === 'stalled');
    expect(insight).toBeDefined();
    expect(insight?.message).toContain('Drafting');
    expect(insight?.message).toContain('45');
  });

  it('fires for a draft whose last history entry is > 30 days old', () => {
    const pub = basePub({
      stageId: 'draft',
      history: [{ from: 'idea', to: 'draft', at: daysAgo(40) }],
      updatedAt: daysAgo(40),
    });
    expect(computeInsights([pub], NOW).find(i => i.category === 'stalled')).toBeDefined();
  });

  it('does not fire for accepted or published cards', () => {
    const accepted = basePub({ id: 'a', stageId: 'accepted', updatedAt: daysAgo(60) });
    const published = basePub({ id: 'p', stageId: 'published', publishedYear: 2024, updatedAt: daysAgo(60) });
    const insights = computeInsights([accepted, published], NOW);
    expect(insights.find(i => i.category === 'stalled')).toBeUndefined();
  });

  it('does not fire for a freshly-updated draft', () => {
    const pub = basePub({ stageId: 'draft', updatedAt: daysAgo(5) });
    expect(computeInsights([pub], NOW).find(i => i.category === 'stalled')).toBeUndefined();
  });
});

describe('computeInsights · missing_year', () => {
  it('fires only when publishedYear === "unknown"', () => {
    const orphan = basePub({ id: 'o', stageId: 'published', publishedYear: 'unknown' });
    const good = basePub({ id: 'g', stageId: 'published', publishedYear: 2025 });
    const insight = computeInsights([orphan, good], NOW).find(i => i.category === 'missing_year');
    expect(insight).toBeDefined();
    expect(insight?.message).toMatch(/^1 published paper has no year yet$/);
  });

  it('pluralises correctly when there are multiple', () => {
    const pubs = [
      basePub({ id: 'a', stageId: 'published', publishedYear: 'unknown' }),
      basePub({ id: 'b', stageId: 'published', publishedYear: 'unknown' }),
    ];
    const insight = computeInsights(pubs, NOW).find(i => i.category === 'missing_year');
    expect(insight?.message).toContain('2 published papers');
  });
});

describe('computeInsights · missing_authors', () => {
  it('fires for cards with empty authors', () => {
    const pub = basePub({ authors: '' });
    expect(computeInsights([pub], NOW).find(i => i.category === 'missing_authors')).toBeDefined();
  });

  it('fires for whitespace-only authors', () => {
    const pub = basePub({ authors: '   ' });
    expect(computeInsights([pub], NOW).find(i => i.category === 'missing_authors')).toBeDefined();
  });
});

describe('computeInsights · quick_wins', () => {
  it('fires when there are accepted cards', () => {
    const pub = basePub({ stageId: 'accepted' });
    expect(computeInsights([pub], NOW).find(i => i.category === 'quick_wins')).toBeDefined();
  });
});

describe('computeInsights · momentum', () => {
  it('reports "up from" when this year > last year at the same point', () => {
    // NOW = Apr 21 2026. 'Same point last year' = through Apr 21 2025.
    const pubs = [
      basePub({ id: 'a', stageId: 'published', publishedYear: 2026,
        history: [{ from: 'accepted', to: 'published', at: '2026-02-10T00:00:00.000Z' }] }),
      basePub({ id: 'b', stageId: 'published', publishedYear: 2026,
        history: [{ from: 'accepted', to: 'published', at: '2026-03-15T00:00:00.000Z' }] }),
      basePub({ id: 'c', stageId: 'published', publishedYear: 2025,
        history: [{ from: 'accepted', to: 'published', at: '2025-02-14T00:00:00.000Z' }] }),
    ];
    const insight = computeInsights(pubs, NOW).find(i => i.category === 'momentum');
    expect(insight).toBeDefined();
    expect(insight?.message).toContain('up from 1');
  });

  it('reports "same as" when the numbers match', () => {
    const pubs = [
      basePub({ id: 'a', stageId: 'published', publishedYear: 2026,
        history: [{ from: 'accepted', to: 'published', at: '2026-02-10T00:00:00.000Z' }] }),
      basePub({ id: 'b', stageId: 'published', publishedYear: 2025,
        history: [{ from: 'accepted', to: 'published', at: '2025-03-12T00:00:00.000Z' }] }),
    ];
    const insight = computeInsights(pubs, NOW).find(i => i.category === 'momentum');
    expect(insight?.message).toContain('same as');
  });

  it('ignores last-year publications dated after the current day-of-year', () => {
    // Published late 2025 (after Apr 21) should NOT count toward "same point last year".
    const pubs = [
      basePub({ id: 'c', stageId: 'published', publishedYear: 2025,
        history: [{ from: 'accepted', to: 'published', at: '2025-09-01T00:00:00.000Z' }] }),
    ];
    const insight = computeInsights(pubs, NOW).find(i => i.category === 'momentum');
    // With 0 this year and 0 counted from last year, no momentum insight fires at all.
    expect(insight).toBeUndefined();
  });
});

describe('computeInsights · sort order', () => {
  it('puts celebration before everything else', () => {
    const pubs = [
      basePub({ id: 'stuck', stageId: 'draft', updatedAt: daysAgo(60) }),
      basePub({ id: 'acc', stageId: 'accepted' }),
      basePub({ id: 'new', stageId: 'published', publishedYear: 2026,
        history: [{ from: 'accepted', to: 'published', at: daysAgo(2) }] }),
    ];
    const insights = computeInsights(pubs, NOW);
    expect(insights[0].category).toBe('celebration');
  });

  it('puts older stalled cards before newer stalled cards', () => {
    const pubs = [
      basePub({ id: 'newer', stageId: 'draft', updatedAt: daysAgo(31) }),
      basePub({ id: 'older', stageId: 'draft', updatedAt: daysAgo(90) }),
    ];
    const stalled = computeInsights(pubs, NOW).filter(i => i.category === 'stalled');
    expect(stalled[0].id).toBe('stalled:older');
    expect(stalled[1].id).toBe('stalled:newer');
  });
});
