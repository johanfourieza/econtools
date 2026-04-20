import { PubFlowState, Publication, BinItem, DEFAULT_STAGES } from '@/types/publication';

const STORAGE_KEY = 'kabbo.local.v1';

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix = 'c'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createEmptyState(): PubFlowState {
  const now = nowIso();
  
  // Create sample publications to demonstrate the app
  const sampleCards: Publication[] = [
    {
      id: uid('c'),
      title: 'AI and the Future of Academic Publishing',
      authors: 'Thompson, Chen',
      themes: 'AI, Publishing, Technology',
      grants: 'NSF',
      completionYear: '2026',
      stageId: 'idea',
      outputType: 'journal',
      typeA: 'Nature Human Behaviour',
      typeB: '',
      typeC: '',
      workingPaper: { on: false, series: '', number: '', url: '' },
      notes: 'Exploring how large language models and AI tools are reshaping peer review, authorship, and the dissemination of scientific knowledge.',
      links: [],
      collaborationLinks: [],
      reminders: [],
      collaborators: [],
      publishedYear: '',
      createdAt: now,
      updatedAt: now,
      history: [],
    },
    {
      id: uid('c'),
      title: 'On Footnotes',
      authors: 'Gibbon',
      themes: 'Historiography, Methodology',
      grants: '',
      completionYear: '2025',
      stageId: 'draft',
      outputType: 'journal',
      typeA: 'History and Theory',
      typeB: '',
      typeC: '',
      workingPaper: { on: true, series: 'SSRN Working Paper', number: '', url: '' },
      notes: 'A meditation on the footnote as a literary and scholarly device, from Gibbon to Grafton.',
      links: [],
      collaborationLinks: [],
      reminders: [],
      collaborators: [],
      publishedYear: '',
      createdAt: now,
      updatedAt: now,
      history: [],
    },
    {
      id: uid('c'),
      title: 'How Societies Collapse: A Case Study of Academic Apps',
      authors: 'Martinez, Okonkwo',
      themes: 'Technology, Sociology, Academia',
      grants: 'Mellon Foundation',
      completionYear: '2025',
      stageId: 'submitted',
      outputType: 'journal',
      typeA: 'American Sociological Review',
      typeB: '',
      typeC: '',
      workingPaper: { on: false, series: '', number: '', url: '' },
      notes: 'Why do promising academic tools fail? A post-mortem of defunct platforms and their institutional pathologies.',
      links: [],
      collaborationLinks: [],
      reminders: [],
      collaborators: [],
      publishedYear: '',
      createdAt: now,
      updatedAt: now,
      history: [],
    },
    {
      id: uid('c'),
      title: 'How I Won the Nobel Prize',
      authors: 'Scholar',
      themes: 'Autobiography, Science',
      grants: '',
      completionYear: '2025',
      stageId: 'resubmit',
      outputType: 'journal',
      typeA: 'Annals of Improbable Research',
      typeB: '',
      typeC: '',
      workingPaper: { on: false, series: '', number: '', url: '' },
      notes: 'A speculative memoir from the future. Reviewers found it "overly optimistic" but encouraged resubmission.',
      links: [],
      collaborationLinks: [],
      reminders: [],
      collaborators: [],
      publishedYear: '',
      createdAt: now,
      updatedAt: now,
      history: [],
    },
    {
      id: uid('c'),
      title: 'Culture, Institutions, and Social Equilibria: A Framework',
      authors: 'Acemoglu, Robinson',
      themes: 'Institutions, Culture, Political Economy',
      grants: '',
      completionYear: '',
      stageId: 'published',
      outputType: 'journal',
      typeA: 'Journal of Economic Literature',
      typeB: '',
      typeC: '',
      workingPaper: { on: false, series: '', number: '', url: '' },
      notes: 'A unified framework for understanding how culture and institutions co-evolve.',
      links: [],
      collaborationLinks: [],
      reminders: [],
      collaborators: [],
      publishedYear: 2025,
      createdAt: now,
      updatedAt: now,
      history: [],
    },
  ];
  
  return {
    board: {
      title: 'Kabbo',
      subtitle: 'Because research is a journey.',
      paletteId: 'burnt-fieldnotes',
      stages: [...DEFAULT_STAGES],
      createdAt: now,
      updatedAt: now,
    },
    cards: sampleCards,
    bin: [],
  };
}

// Old subtitles that should be migrated to the new one
const OLD_SUBTITLES = [
  'A compressed, zippy funnel-path where ideas are shaped into outputs',
  'A zippy funnel-path where ideas are shaped into publications',
  'Academic Publication Pipeline',
];

export function normalizeState(s: Partial<PubFlowState>): PubFlowState {
  const state = createEmptyState();
  
  if (s.board) {
    // Migrate old subtitles to new one
    const savedSubtitle = s.board.subtitle;
    const shouldMigrate = !savedSubtitle || OLD_SUBTITLES.includes(savedSubtitle);
    
    state.board = {
      ...state.board,
      title: s.board.title || state.board.title,
      subtitle: shouldMigrate ? state.board.subtitle : savedSubtitle,
      paletteId: s.board.paletteId || state.board.paletteId,
      stages: Array.isArray(s.board.stages) && s.board.stages.length > 0 
        ? s.board.stages 
        : state.board.stages,
      createdAt: s.board.createdAt || state.board.createdAt,
      updatedAt: s.board.updatedAt || state.board.updatedAt,
    };
  }

  if (Array.isArray(s.cards)) {
    state.cards = s.cards.map(normalizeCard);
  }

  if (Array.isArray(s.bin)) {
    state.bin = s.bin.map(normalizeBinItem);
  }

  return state;
}

function normalizeCard(c: Partial<Publication>): Publication {
  // Migrate legacy githubRepo/overleafLink to collaborationLinks
  const collaborationLinks = Array.isArray(c.collaborationLinks) ? c.collaborationLinks : [];
  if (c.githubRepo && !collaborationLinks.some(l => l.type === 'github')) {
    collaborationLinks.push({ type: 'github', url: c.githubRepo });
  }
  if (c.overleafLink && !collaborationLinks.some(l => l.type === 'overleaf')) {
    collaborationLinks.push({ type: 'overleaf', url: c.overleafLink });
  }

  return {
    id: c.id || uid('c'),
    title: c.title || '',
    authors: c.authors || '',
    themes: c.themes || '',
    grants: c.grants || '',
    completionYear: c.completionYear || '',
    stageId: c.stageId || 'idea',
    outputType: c.outputType || 'journal',
    typeA: c.typeA || '',
    typeB: c.typeB || '',
    typeC: c.typeC || '',
    workingPaper: c.workingPaper || { on: false, series: '', number: '', url: '' },
    notes: c.notes || '',
    links: Array.isArray(c.links) ? c.links : [],
    collaborationLinks,
    githubRepo: c.githubRepo || '',
    overleafLink: c.overleafLink || '',
    reminders: Array.isArray(c.reminders) ? c.reminders : [],
    collaborators: Array.isArray(c.collaborators) ? c.collaborators : [],
    publishedYear: c.publishedYear ?? '',
    createdAt: c.createdAt || nowIso(),
    updatedAt: c.updatedAt || nowIso(),
    history: Array.isArray(c.history) ? c.history : [],
  };
}

function normalizeBinItem(b: Partial<BinItem>): BinItem {
  return {
    id: b.id || uid('b'),
    title: b.title || '',
    reason: b.reason || '',
    binnedAt: b.binnedAt || nowIso(),
    fromStageId: b.fromStageId || 'idea',
    card: b.card ? normalizeCard(b.card) : null,
  };
}

export function loadState(): PubFlowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return createEmptyState();
  }
}

export function saveState(state: PubFlowState): void {
  try {
    const toSave = {
      ...state,
      board: {
        ...state.board,
        updatedAt: nowIso(),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

export function createNewPublication(stageId = 'idea'): Publication {
  return {
    id: uid('c'),
    title: '',
    authors: '',
    themes: '',
    grants: '',
    completionYear: '',
    stageId,
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
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [],
  };
}

export function parseList(s: string): string[] {
  return s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}
