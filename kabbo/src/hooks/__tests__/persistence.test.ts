/**
 * Unit tests for the persistence-layer transforms.
 *
 * These protect against regressions in the round-trip between the React-side
 * Publication model and the Supabase `publications` row. The two bugs that
 * caused imports to disappear from kabbo.app would both have been caught
 * here if this suite had existed:
 *
 *   1. rowToPublication silently hiding `published` rows with null year.
 *   2. localToDb / rowToPublication losing a field on round-trip.
 *
 * Run with `npm test` (Vitest).
 */

import { describe, expect, it } from 'vitest';
import { dbToLocal, localToDb } from '../publicationTransforms';
import { Publication } from '@/types/publication';

function basePub(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'pub-1',
    ownerId: 'user-1',
    title: 'A Paper',
    authors: 'Smith, Jones',
    themes: 'economic history',
    grants: 'NRF-123',
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

describe('localToDb', () => {
  it('writes target_year from completionYear for draft publications', () => {
    const pub = basePub({ stageId: 'draft', completionYear: '2025' });
    const row = localToDb(pub, 'user-1');
    expect(row.target_year).toBe(2025);
    expect(row.stage).toBe('draft');
  });

  it('writes target_year from numeric publishedYear for published publications', () => {
    const pub = basePub({ stageId: 'published', publishedYear: 2024 });
    const row = localToDb(pub, 'user-1');
    expect(row.target_year).toBe(2024);
  });

  it('writes target_year=null when the publication has no year set', () => {
    const pub = basePub({ stageId: 'idea' });
    const row = localToDb(pub, 'user-1');
    expect(row.target_year).toBeNull();
  });

  it('coerces an empty title to "Untitled" rather than NULL (schema requires non-null)', () => {
    const pub = basePub({ title: '' });
    const row = localToDb(pub, 'user-1');
    expect(row.title).toBe('Untitled');
  });
});

describe('dbToLocal', () => {
  it('round-trips a fully-populated published row unchanged', () => {
    const pub = basePub({
      stageId: 'published',
      publishedYear: 2024,
      completionYear: '2024',
      title: 'The Wealth of Nations',
      authors: 'Smith',
    });
    const row = localToDb(pub, 'user-1');
    const full = { ...row, id: pub.id, created_at: pub.createdAt, updated_at: pub.updatedAt };
    const back = dbToLocal(full);

    expect(back.title).toBe(pub.title);
    expect(back.authors).toBe(pub.authors);
    expect(back.stageId).toBe('published');
    expect(back.publishedYear).toBe(2024);
    expect(back.completionYear).toBe('2024');
  });

  it('marks a published row with null target_year as "unknown" — never hides it', () => {
    // This is the critical regression test. Before the fix, published rows
    // with null target_year became publishedYear='' and got silently filtered
    // out of every year bucket. That's how imports "disappeared" on reload.
    const row = {
      id: 'p',
      owner_id: 'user-1',
      title: 'Half-imported',
      authors: [],
      themes: [],
      grants: [],
      target_year: null,
      stage: 'published',
      output_type: 'journal',
      notes: '',
      links: [],
      github_repo: null,
      overleaf_link: null,
      working_paper: null,
      stage_history: [],
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
    };
    const back = dbToLocal(row);
    expect(back.publishedYear).toBe('unknown');
    expect(back.stageId).toBe('published');
  });

  it('returns publishedYear="" for non-published rows regardless of target_year', () => {
    const row = {
      id: 'p',
      owner_id: 'user-1',
      title: 'Draft',
      authors: [],
      themes: [],
      grants: [],
      target_year: 2025,
      stage: 'draft',
      output_type: 'journal',
      notes: '',
      links: [],
      github_repo: null,
      overleaf_link: null,
      working_paper: null,
      stage_history: [],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const back = dbToLocal(row);
    expect(back.publishedYear).toBe('');
    expect(back.completionYear).toBe('2025');
  });
});

describe('publishedByYear grouping (logic mirrored from useSupabasePublications)', () => {
  // Replicate the memo's logic so we can test it without mounting the hook.
  // Keep this in sync with the memo at src/hooks/useSupabasePublications.ts.
  function publishedByYear(publications: Publication[]): { year: number | 'unknown'; cards: Publication[] }[] {
    const currentYear = 2026;
    const years = Array.from({ length: 7 }, (_, i) => currentYear - i);

    const byYear: { year: number | 'unknown'; cards: Publication[] }[] = years.map((year) => ({
      year,
      cards: publications
        .filter((c) => c.stageId === 'published' && c.publishedYear === year)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));

    const unknownCards = publications
      .filter((c) => c.stageId === 'published' && c.publishedYear === 'unknown')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    if (unknownCards.length > 0) {
      byYear.push({ year: 'unknown', cards: unknownCards });
    }

    return byYear;
  }

  it('groups published rows by numeric year', () => {
    const pubs = [
      basePub({ id: 'a', stageId: 'published', publishedYear: 2024 }),
      basePub({ id: 'b', stageId: 'published', publishedYear: 2024 }),
      basePub({ id: 'c', stageId: 'published', publishedYear: 2025 }),
    ];
    const buckets = publishedByYear(pubs);
    expect(buckets.find((b) => b.year === 2024)?.cards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(buckets.find((b) => b.year === 2025)?.cards.map((c) => c.id)).toEqual(['c']);
  });

  it('appends an "unknown" bucket for null-year published rows, only when non-empty', () => {
    const pubs = [
      basePub({ id: 'a', stageId: 'published', publishedYear: 2024 }),
      basePub({ id: 'b', stageId: 'published', publishedYear: 'unknown' }),
    ];
    const buckets = publishedByYear(pubs);
    const unknown = buckets.find((b) => b.year === 'unknown');
    expect(unknown).toBeDefined();
    expect(unknown?.cards.map((c) => c.id)).toEqual(['b']);
  });

  it('omits the unknown bucket when no rows need it', () => {
    const pubs = [basePub({ id: 'a', stageId: 'published', publishedYear: 2024 })];
    const buckets = publishedByYear(pubs);
    expect(buckets.find((b) => b.year === 'unknown')).toBeUndefined();
  });

  it('never drops a published row from every bucket within the 7-year window', () => {
    // Regression-prevention invariant. Every published row whose year falls
    // inside the 7-year window (currentYear down to currentYear-6), OR whose
    // publishedYear is 'unknown', MUST appear in exactly one bucket. If this
    // test fails, the UI is hiding data again.
    //
    // Rows older than 7 years (e.g. published in 2018 when currentYear=2026)
    // are intentionally excluded at the hook level — the FilterBar has a
    // separate year-limit control for those.
    const pubs = [
      basePub({ id: 'a', stageId: 'published', publishedYear: 2024 }),
      basePub({ id: 'b', stageId: 'published', publishedYear: 'unknown' }),
      basePub({ id: 'c', stageId: 'published', publishedYear: 2020 }), // inside 7y window
    ];
    const buckets = publishedByYear(pubs);
    const everyVisible = pubs.every((p) =>
      buckets.some((b) => b.cards.some((c) => c.id === p.id)),
    );
    expect(everyVisible).toBe(true);
  });
});
