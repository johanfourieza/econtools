import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PubFlowState, Publication, BinItem, DEFAULT_STAGES, HistoryEntry } from '@/types/publication';
import { useAuth } from '@/hooks/useAuth';
import { parseList, createEmptyState } from '@/lib/storage';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

interface Filters {
  author: string;
  theme: string;
  grant: string;
  year: string;
  search: string;
}

interface UndoEntry {
  cardId: string;
  fromStage: string;
  toStage: string;
}

// Convert database publication to local Publication format
function dbToLocal(dbPub: any): Publication {
  // Migrate legacy github/overleaf to collaborationLinks
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
    typeA: '',
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
    // If a row is in the "published" stage but its target_year is missing,
    // leave publishedYear empty rather than silently fabricating the current
    // year. Fabricating a year is what caused orphan rows to pile up in the
    // 2026 column. Rows with no year now stay out of the year grid until the
    // user assigns one.
    publishedYear: dbPub.stage === 'published' && dbPub.target_year != null
      ? dbPub.target_year
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

// Convert local Publication to database format
function localToDb(pub: Publication, userId: string): {
  id: string;
  owner_id: string;
  title: string;
  authors: string[];
  themes: string[];
  grants: string[];
  target_year: number | null;
  stage: string;
  output_type: string;
  notes: string;
  links: string[];
  github_repo: string | null;
  overleaf_link: string | null;
  working_paper: any;
  stage_history: any[];
} {
  const targetYear = pub.completionYear ? parseInt(pub.completionYear) : 
    (typeof pub.publishedYear === 'number' ? pub.publishedYear : null);
  
  return {
    id: pub.id,
    owner_id: userId,
    title: pub.title || 'Untitled',
    authors: parseList(pub.authors),
    themes: parseList(pub.themes),
    grants: parseList(pub.grants),
    target_year: targetYear,
    stage: pub.stageId,
    output_type: pub.outputType,
    notes: pub.notes,
    links: pub.links.map(l => JSON.stringify(l)),
    github_repo: pub.githubRepo || null,
    overleaf_link: pub.overleafLink || null,
    working_paper: pub.workingPaper,
    stage_history: pub.history.map(h => ({ from: h.from, to: h.to, at: h.at })),
  };
}

export function useSupabasePublications() {
  const { user, isAuthenticated } = useAuth();
  const { isOnline, isSyncing, pendingCount, executeOrQueue } = useOfflineQueue();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [bin, setBin] = useState<BinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    author: '',
    theme: '',
    grant: '',
    year: '',
    search: '',
  });
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  // Board config (stored locally for now)
  const [board] = useState({
    title: 'Kabbo',
    subtitle: 'Because research is a journey.',
    paletteId: 'burnt-fieldnotes',
    stages: [...DEFAULT_STAGES],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Load publications from Supabase - fetch in parallel for speed
  // This includes both owned publications AND publications where user is an accepted collaborator
  const loadPublications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Fetch owned publications, collaborated publications, and bin items IN PARALLEL
      const [ownedPubsResult, collabsResult, binResult] = await Promise.all([
        // 1. Owned publications
        supabase
          .from('publications')
          .select('id, owner_id, title, authors, themes, grants, target_year, stage, output_type, notes, links, github_repo, overleaf_link, data_sources, related_papers, working_paper, stage_history, created_at, updated_at')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false }),
        // 2. Get collaborated publication IDs first
        supabase
          .from('publication_collaborators')
          .select('publication_id, role')
          .eq('user_id', user.id)
          .eq('status', 'accepted'),
        // 3. Bin items
        supabase
          .from('publication_bin')
          .select('id, original_stage, deleted_at, publication_data')
          .eq('user_id', user.id)
          .order('deleted_at', { ascending: false })
          .limit(50)
      ]);

      if (ownedPubsResult.error) throw ownedPubsResult.error;
      if (binResult.error) throw binResult.error;

      // Convert owned publications
      const ownedPubs = (ownedPubsResult.data || []).map(dbToLocal);
      
      // Fetch collaborated publications if any exist
      let collabPubs: Publication[] = [];
      if (collabsResult.data && collabsResult.data.length > 0) {
        const collabIds = collabsResult.data.map(c => c.publication_id);
        const collabRoles = new Map(collabsResult.data.map(c => [c.publication_id, c.role]));
        
        const { data: collabPubsData, error: collabPubsError } = await supabase
          .from('publications')
          .select('id, owner_id, title, authors, themes, grants, target_year, stage, output_type, notes, links, github_repo, overleaf_link, data_sources, related_papers, working_paper, stage_history, created_at, updated_at')
          .in('id', collabIds)
          .order('updated_at', { ascending: false });
        
        if (collabPubsError) {
          console.error('Error loading collaborated publications:', collabPubsError);
        } else {
          // Convert and mark as collaborations
          collabPubs = (collabPubsData || []).map(pub => {
            const localPub = dbToLocal(pub);
            return {
              ...localPub,
              isCollaboration: true,
              myRole: collabRoles.get(pub.id) as 'viewer' | 'editor' | undefined,
            };
          });
        }
      }
      
      // Merge owned and collaborated publications, avoiding duplicates
      const ownedIds = new Set(ownedPubs.map(p => p.id));
      const allPubs = [
        ...ownedPubs,
        ...collabPubs.filter(p => !ownedIds.has(p.id)), // Exclude if user is both owner and collaborator
      ];
      
      setPublications(allPubs);

      const localBin: BinItem[] = (binResult.data || []).map((b: any) => ({
        id: b.id,
        title: (b.publication_data as any)?.title || 'Untitled',
        reason: '',
        binnedAt: b.deleted_at,
        fromStageId: b.original_stage,
        card: b.publication_data ? dbToLocal(b.publication_data) : null,
      }));
      setBin(localBin);

    } catch (error) {
      console.error('Error loading publications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load on mount and when user changes
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadPublications();
    } else if (!isAuthenticated) {
      // If not authenticated, don't keep loading state
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, loadPublications]);

  // Real-time subscription for publications
  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    console.log('Setting up realtime subscription for publications');
    
    const channel = supabase
      .channel('publications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'publications',
        },
        (payload) => {
          console.log('Realtime event:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            const newPub = dbToLocal(payload.new);
            // Only add if we don't already have it (avoid duplicates from our own inserts)
            setPublications(prev => {
              if (prev.some(p => p.id === newPub.id)) return prev;
              return [newPub, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedPub = dbToLocal(payload.new);
            setPublications(prev => 
              prev.map(p => p.id === updatedPub.id ? updatedPub : p)
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              setPublications(prev => prev.filter(p => p.id !== deletedId));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAuthenticated]);

  // State object for compatibility
  const state: PubFlowState = useMemo(() => ({
    board,
    cards: publications,
    bin,
  }), [board, publications, bin]);

  // Get pipeline stages (excluding published)
  const pipelineStages = useMemo(() => {
    return board.stages.filter(s => s.id !== 'published');
  }, [board.stages]);

  // Compute filter options from cards
  const filterOptions = useMemo(() => {
    const authors = new Set<string>();
    const themes = new Set<string>();
    const grants = new Set<string>();
    const years = new Set<string>();

    publications.forEach(card => {
      parseList(card.authors).forEach(a => authors.add(a));
      parseList(card.themes).forEach(t => themes.add(t));
      parseList(card.grants).forEach(g => grants.add(g));
      if (card.completionYear) years.add(card.completionYear);
    });

    return {
      authors: Array.from(authors).sort(),
      themes: Array.from(themes).sort(),
      grants: Array.from(grants).sort(),
      years: Array.from(years).sort((a, b) => Number(b) - Number(a)),
    };
  }, [publications]);

  // Filter cards
  const matchesFilters = useCallback((card: Publication): boolean => {
    if (filters.author && !parseList(card.authors).includes(filters.author)) return false;
    if (filters.theme && !parseList(card.themes).includes(filters.theme)) return false;
    if (filters.grant && !parseList(card.grants).includes(filters.grant)) return false;
    if (filters.year) {
      if (filters.year === '__none__') {
        if (card.completionYear) return false;
      } else {
        if (card.completionYear !== filters.year) return false;
      }
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!card.title.toLowerCase().includes(q)) return false;
    }
    return true;
  }, [filters]);

  // Get cards for a specific stage
  const getCardsForStage = useCallback((stageId: string) => {
    return publications
      .filter(c => c.stageId === stageId && matchesFilters(c))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [publications, matchesFilters]);

  // Get published cards grouped by year
  const publishedByYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - i);
    
    return years.map(year => ({
      year,
      cards: publications
        .filter(c => c.stageId === 'published' && c.publishedYear === year && matchesFilters(c))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));
  }, [publications, matchesFilters]);

  // Add new publication
  const addPublication = useCallback(async (stageId = 'idea') => {
    if (!user?.id) return null;

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newPub: Publication = {
      id: newId,
      ownerId: user.id,
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
      createdAt: now,
      updatedAt: now,
      history: [],
    };

    // Optimistically update local state
    setPublications(prev => [newPub, ...prev]);

    // Insert into database (or queue if offline)
    const dbData = localToDb(newPub, user.id);
    await executeOrQueue(
      { type: 'insert', table: 'publications', data: dbData },
      async () => {
        const { error } = await supabase
          .from('publications')
          .insert(dbData);
        if (error) throw error;
      }
    );

    return newPub;
  }, [user?.id, executeOrQueue]);

  // Update publication
  const updatePublication = useCallback(async (id: string, updates: Partial<Publication>) => {
    if (!user?.id) return;

    const now = new Date().toISOString();
    
    // Optimistically update local state
    setPublications(prev => prev.map(c => 
      c.id === id 
        ? { ...c, ...updates, updatedAt: now }
        : c
    ));

    // Get the full updated publication
    const pub = publications.find(p => p.id === id);
    if (!pub) return;

    const updated = { ...pub, ...updates, updatedAt: now };
    
    // Build update object for Supabase
    const dbUpdate: any = {
      updated_at: now,
    };

    if ('title' in updates) dbUpdate.title = updates.title || 'Untitled';
    if ('authors' in updates) dbUpdate.authors = parseList(updates.authors || '');
    if ('themes' in updates) dbUpdate.themes = parseList(updates.themes || '');
    if ('grants' in updates) dbUpdate.grants = parseList(updates.grants || '');
    if ('completionYear' in updates) dbUpdate.target_year = updates.completionYear ? parseInt(updates.completionYear) : null;
    if ('stageId' in updates) dbUpdate.stage = updates.stageId;
    if ('notes' in updates) dbUpdate.notes = updates.notes;
    if ('outputType' in updates) dbUpdate.output_type = updates.outputType;
    if ('githubRepo' in updates) dbUpdate.github_repo = updates.githubRepo || null;
    if ('overleafLink' in updates) dbUpdate.overleaf_link = updates.overleafLink || null;
    if ('links' in updates) dbUpdate.links = (updates.links || []).map((l: any) => JSON.stringify(l));
    if ('workingPaper' in updates) dbUpdate.working_paper = updates.workingPaper;
    if ('history' in updates) dbUpdate.stage_history = (updates.history || []).map(h => ({ from: h.from, to: h.to, at: h.at }));
    if ('publishedYear' in updates && updates.stageId === 'published') {
      dbUpdate.target_year = updates.publishedYear || new Date().getFullYear();
    }

    await executeOrQueue(
      { type: 'update', table: 'publications', data: dbUpdate, filters: { column: 'id', value: id } },
      async () => {
        const { error } = await supabase
          .from('publications')
          .update(dbUpdate)
          .eq('id', id);
        if (error) throw error;
      }
    );
  }, [user?.id, publications, executeOrQueue]);

  // Move publication to stage
  const moveToStage = useCallback(async (cardId: string, newStageId: string, publishedYear?: number) => {
    if (!user?.id) return;

    const card = publications.find(c => c.id === cardId);
    if (!card || card.stageId === newStageId) return;
    
    // Only owner or editors can move publications
    if (card.isCollaboration && card.myRole !== 'editor') {
      console.warn('Viewer cannot move collaborator publications');
      return;
    }

    const now = new Date().toISOString();
    const historyEntry: HistoryEntry = {
      from: card.stageId,
      to: newStageId,
      at: now,
    };

    // Add to undo stack
    setUndoStack(stack => [...stack.slice(-79), { cardId, fromStage: card.stageId, toStage: newStageId }]);

    const updatedHistory = [...card.history, historyEntry];
    const newPublishedYear = newStageId === 'published' ? (publishedYear ?? new Date().getFullYear()) : card.publishedYear;

    // Optimistically update local state
    setPublications(prev => prev.map(c =>
      c.id === cardId
        ? {
            ...c,
            stageId: newStageId,
            publishedYear: newPublishedYear,
            updatedAt: now,
            history: updatedHistory,
          }
        : c
    ));

    // Update in database
    const updateData = {
      stage: newStageId,
      target_year: newStageId === 'published' 
        ? (typeof newPublishedYear === 'number' ? newPublishedYear : new Date().getFullYear())
        : (card.completionYear ? parseInt(card.completionYear) : null),
      updated_at: now,
      stage_history: updatedHistory.map(h => ({ from: h.from, to: h.to, at: h.at })),
    };
    
    await executeOrQueue(
      { type: 'update', table: 'publications', data: updateData, filters: { column: 'id', value: cardId } },
      async () => {
        const { error } = await supabase
          .from('publications')
          .update(updateData)
          .eq('id', cardId);
        if (error) throw error;
      }
    );
  }, [user?.id, publications, executeOrQueue]);

  // Undo last move
  const undo = useCallback(async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last || !user?.id) return;

    const now = new Date().toISOString();

    // Optimistically update
    setPublications(prev => prev.map(c =>
      c.id === last.cardId
        ? { ...c, stageId: last.fromStage, updatedAt: now }
        : c
    ));

    setUndoStack(stack => stack.slice(0, -1));

    // Update in database
    const updateData = { stage: last.fromStage, updated_at: now };
    
    await executeOrQueue(
      { type: 'update', table: 'publications', data: updateData, filters: { column: 'id', value: last.cardId } },
      async () => {
        const { error } = await supabase
          .from('publications')
          .update(updateData)
          .eq('id', last.cardId);
        if (error) throw error;
      }
    );
  }, [undoStack, user?.id, executeOrQueue]);

  // Move to bin
  const moveToBin = useCallback(async (cardId: string, reason = '') => {
    if (!user?.id) return;

    const card = publications.find(c => c.id === cardId);
    if (!card) return;

    const now = new Date().toISOString();
    const binItem: BinItem = {
      id: crypto.randomUUID(),
      title: card.title,
      reason,
      binnedAt: now,
      fromStageId: card.stageId,
      card,
    };

    // Optimistically update local state
    setPublications(prev => prev.filter(c => c.id !== cardId));
    setBin(prev => [binItem, ...prev]);

    // Insert into bin table
    const binData = {
      id: binItem.id,
      user_id: user.id,
      original_stage: card.stageId,
      publication_data: localToDb(card, user.id),
      deleted_at: now,
    };
    
    await executeOrQueue(
      { type: 'insert', table: 'publication_bin', data: binData },
      async () => {
        const { error } = await supabase
          .from('publication_bin')
          .insert(binData);
        if (error) throw error;
      }
    );

    // Delete from publications table
    await executeOrQueue(
      { type: 'delete', table: 'publications', filters: { column: 'id', value: cardId } },
      async () => {
        const { error } = await supabase
          .from('publications')
          .delete()
          .eq('id', cardId);
        if (error) throw error;
      }
    );
  }, [user?.id, publications, executeOrQueue]);

  // Restore from bin
  const restoreFromBin = useCallback(async (binId: string) => {
    if (!user?.id) return;

    const binItem = bin.find(b => b.id === binId);
    if (!binItem?.card) return;

    const restoredCard = { ...binItem.card, stageId: binItem.fromStageId };

    // Optimistically update
    setPublications(prev => [restoredCard, ...prev]);
    setBin(prev => prev.filter(b => b.id !== binId));

    // Insert back into publications
    const { error: insertError } = await supabase
      .from('publications')
      .insert(localToDb(restoredCard, user.id));

    if (insertError) {
      console.error('Error restoring publication:', insertError);
      loadPublications();
      return;
    }

    // Delete from bin
    const { error: delError } = await supabase
      .from('publication_bin')
      .delete()
      .eq('id', binId);

    if (delError) {
      console.error('Error removing from bin:', delError);
    }
  }, [user?.id, bin, loadPublications]);

  // Delete from bin
  const deleteFromBin = useCallback(async (binId: string) => {
    if (!user?.id) return;

    // Optimistically update
    setBin(prev => prev.filter(b => b.id !== binId));

    const { error } = await supabase
      .from('publication_bin')
      .delete()
      .eq('id', binId);

    if (error) {
      console.error('Error deleting from bin:', error);
      loadPublications();
    }
  }, [user?.id, loadPublications]);

  // Clear all bin
  const clearBin = useCallback(async () => {
    if (!user?.id) return;

    // Optimistically update
    setBin([]);

    const { error } = await supabase
      .from('publication_bin')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing bin:', error);
      loadPublications();
    }
  }, [user?.id, loadPublications]);

  // Clear all publications
  const clearAll = useCallback(async () => {
    if (!user?.id) return;

    // Optimistically update
    setPublications([]);
    setBin([]);
    setUndoStack([]);

    // Delete all publications
    const { error: pubError } = await supabase
      .from('publications')
      .delete()
      .eq('owner_id', user.id);

    if (pubError) {
      console.error('Error clearing publications:', pubError);
    }

    // Delete all bin items
    const { error: binError } = await supabase
      .from('publication_bin')
      .delete()
      .eq('user_id', user.id);

    if (binError) {
      console.error('Error clearing bin:', binError);
    }

    loadPublications();
  }, [user?.id, loadPublications]);

  // Reset to demo
  const resetToDemo = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Delete all publications first
      const { error: pubError } = await supabase
        .from('publications')
        .delete()
        .eq('owner_id', user.id);

      if (pubError) {
        console.error('Error clearing publications:', pubError);
      }

      // Delete all bin items
      const { error: binError } = await supabase
        .from('publication_bin')
        .delete()
        .eq('user_id', user.id);

      if (binError) {
        console.error('Error clearing bin:', binError);
      }

      // Create demo publications
      const demoState = createEmptyState();
      const now = new Date().toISOString();
      
      const demoPublications = demoState.cards.map(card => {
        const workingPaperJson = card.workingPaper 
          ? { on: Boolean(card.workingPaper.on), series: String(card.workingPaper.series || ''), number: String(card.workingPaper.number || ''), url: String(card.workingPaper.url || '') }
          : { on: false, series: '', number: '', url: '' };
          
        return {
          id: crypto.randomUUID(),
          owner_id: user.id,
          title: card.title || 'Untitled',
          authors: parseList(card.authors),
          themes: parseList(card.themes),
          grants: parseList(card.grants),
          target_year: card.stageId === 'published' 
            ? (typeof card.publishedYear === 'number' ? card.publishedYear : new Date().getFullYear())
            : (card.completionYear ? parseInt(card.completionYear) : null),
          stage: card.stageId,
          output_type: card.outputType || 'journal',
          notes: card.notes || '',
          links: card.links.map((l: any) => JSON.stringify(l)),
          github_repo: card.githubRepo || null,
          overleaf_link: card.overleafLink || null,
          working_paper: workingPaperJson as any,
          stage_history: [] as any[],
          created_at: now,
          updated_at: now,
        };
      });

      const { error: insertError } = await supabase
        .from('publications')
        .insert(demoPublications);

      if (insertError) {
        console.error('Error inserting demo publications:', insertError);
      }

      // Reload to get fresh data
      await loadPublications();
    } catch (error) {
      console.error('Error resetting to demo:', error);
      await loadPublications();
    }
  }, [user?.id, loadPublications]);

  // Duplicate publication
  const duplicatePublication = useCallback(async (cardId: string) => {
    if (!user?.id) return null;

    const card = publications.find(c => c.id === cardId);
    if (!card) return null;

    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    
    const newPub: Publication = {
      ...card,
      id: newId,
      title: `${card.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      history: [],
    };

    // Optimistically update
    setPublications(prev => [newPub, ...prev]);

    // Insert into database
    const { error } = await supabase
      .from('publications')
      .insert(localToDb(newPub, user.id));

    if (error) {
      console.error('Error duplicating publication:', error);
      setPublications(prev => prev.filter(p => p.id !== newId));
      return null;
    }

    return newPub;
  }, [user?.id, publications]);

  // Get card by ID
  const getCard = useCallback((id: string) => {
    return publications.find(c => c.id === id);
  }, [publications]);

  // Update board (no-op for now since board is local)
  const updateBoard = useCallback((updates: Partial<typeof board>) => {
    // Board updates are not persisted to Supabase yet
    console.log('Board updates not persisted:', updates);
  }, []);

  return {
    state,
    loading,
    filters,
    setFilters,
    pipelineStages,
    filterOptions,
    getCardsForStage,
    publishedByYear,
    addPublication,
    updatePublication,
    moveToStage,
    undo,
    canUndo: undoStack.length > 0,
    moveToBin,
    restoreFromBin,
    deleteFromBin,
    clearBin,
    clearAll,
    resetToDemo,
    duplicatePublication,
    getCard,
    updateBoard,
    refetch: loadPublications,
    // Offline status
    isOnline,
    isSyncing,
    pendingCount,
  };
}
