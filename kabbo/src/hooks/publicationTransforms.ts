/**
 * Pure transforms between the Supabase `publications` row shape and the
 * React-side Publication model. Extracted from useSupabasePublications so
 * they can be imported by Vitest tests without pulling in the Supabase
 * client (which needs `localStorage` at module load).
 *
 * Keep these free of React, Supabase, and any browser API. They are called
 * on every load, every insert, every update – cheap and deterministic.
 */

import { Publication } from '@/types/publication';
import { parseList } from '@/lib/storage';

// Convert database publication row → React Publication.
export function dbToLocal(dbPub: any): Publication {
  // Migrate legacy github/overleaf to collaborationLinks.
  const collaborationLinks: any[] = [];
  if (dbPub.github_repo) {
    collaborationLinks.push({ type: 'github', url: dbPub.github_repo });
  }
  if (dbPub.overleaf_link) {
    collaborationLinks.push({ type: 'overleaf', url: dbPub.overleaf_link });
  }

  return {
    id: dbPub.id,
    ownerId: dbPub.owner_id,
    title: dbPub.title || '',
    authors: dbPub.authors?.join(', ') || '',
    themes: dbPub.themes?.join(', ') || '',
    grants: dbPub.grants?.join(', ') || '',
    completionYear: dbPub.target_year?.toString() || '',
    stageId: dbPub.stage || 'idea',
    outputType: dbPub.output_type || 'journal',
    // typeA is the UI-facing venue field. Label is polymorphic per outputType
    // ("Intended journal" / "Publisher" / "Book title") but it's one column
    // backed by target_journal in the DB.
    typeA: dbPub.target_journal || '',
    typeB: '',
    typeC: '',
    workingPaper: dbPub.working_paper || { on: false, series: '', number: '', url: '' },
    notes: dbPub.notes || '',
    links: (dbPub.links || []).map((l: string) => {
      try {
        return JSON.parse(l);
      } catch {
        return { label: '', url: l };
      }
    }),
    collaborationLinks,
    githubRepo: dbPub.github_repo || '',
    overleafLink: dbPub.overleaf_link || '',
    reminders: [],
    collaborators: [],
    // Invariant: a row in the "published" stage MUST return a bucketable
    // publishedYear – either a number or the sentinel 'unknown'. Never ''.
    // Returning '' here was the bug that caused imports with null target_year
    // to silently vanish on reload.
    publishedYear: dbPub.stage === 'published'
      ? (dbPub.target_year != null ? dbPub.target_year : 'unknown')
      : '',
    createdAt: dbPub.created_at,
    updatedAt: dbPub.updated_at,
    history: (dbPub.stage_history || []).map((h: any) => ({
      from: h.from || '',
      to: h.to || '',
      at: h.at || '',
    })),
  };
}

// Convert React Publication → database row.
export function localToDb(pub: Publication, userId: string): {
  id: string;
  owner_id: string;
  title: string;
  authors: string[];
  themes: string[];
  grants: string[];
  target_year: number | null;
  target_journal: string | null;
  stage: string;
  output_type: string;
  notes: string;
  links: string[];
  github_repo: string | null;
  overleaf_link: string | null;
  working_paper: any;
  stage_history: any[];
} {
  const targetYear = pub.completionYear
    ? parseInt(pub.completionYear)
    : typeof pub.publishedYear === 'number'
      ? pub.publishedYear
      : null;

  return {
    id: pub.id,
    owner_id: userId,
    title: pub.title || 'Untitled',
    authors: parseList(pub.authors),
    themes: parseList(pub.themes),
    grants: parseList(pub.grants),
    target_year: targetYear,
    target_journal: pub.typeA?.trim() || null,
    stage: pub.stageId,
    output_type: pub.outputType,
    notes: pub.notes,
    links: pub.links.map((l) => JSON.stringify(l)),
    github_repo: pub.githubRepo || null,
    overleaf_link: pub.overleafLink || null,
    working_paper: pub.workingPaper,
    stage_history: pub.history.map((h) => ({ from: h.from, to: h.to, at: h.at })),
  };
}
