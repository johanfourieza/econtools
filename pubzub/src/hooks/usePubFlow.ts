import { useState, useEffect, useCallback, useMemo } from 'react';
import { PubFlowState, Publication, Stage, BinItem, HistoryEntry } from '@/types/publication';
import { loadState, saveState, createNewPublication, parseList, createEmptyState } from '@/lib/storage';

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

export function usePubFlow() {
  const [state, setState] = useState<PubFlowState>(() => loadState());
  const [filters, setFilters] = useState<Filters>({
    author: '',
    theme: '',
    grant: '',
    year: '',
    search: '',
  });
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveState(state);
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  // Get pipeline stages (excluding published)
  const pipelineStages = useMemo(() => {
    return state.board.stages.filter(s => s.id !== 'published');
  }, [state.board.stages]);

  // Compute filter options from cards
  const filterOptions = useMemo(() => {
    const authors = new Set<string>();
    const themes = new Set<string>();
    const grants = new Set<string>();
    const years = new Set<string>();

    state.cards.forEach(card => {
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
  }, [state.cards]);

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
    return state.cards
      .filter(c => c.stageId === stageId && matchesFilters(c))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [state.cards, matchesFilters]);

  // Get published cards grouped by year
  const publishedByYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - i);
    
    return years.map(year => ({
      year,
      cards: state.cards
        .filter(c => c.stageId === 'published' && c.publishedYear === year && matchesFilters(c))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));
  }, [state.cards, matchesFilters]);

  // Add new publication
  const addPublication = useCallback((stageId = 'idea') => {
    const newPub = createNewPublication(stageId);
    setState(prev => ({
      ...prev,
      cards: [...prev.cards, newPub],
    }));
    return newPub;
  }, []);

  // Update publication
  const updatePublication = useCallback((id: string, updates: Partial<Publication>) => {
    setState(prev => ({
      ...prev,
      cards: prev.cards.map(c => 
        c.id === id 
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      ),
    }));
  }, []);

  // Move publication to stage
  const moveToStage = useCallback((cardId: string, newStageId: string, publishedYear?: number) => {
    setState(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card || card.stageId === newStageId) return prev;

      const historyEntry: HistoryEntry = {
        from: card.stageId,
        to: newStageId,
        at: new Date().toISOString(),
      };

      // Add to undo stack
      setUndoStack(stack => [...stack.slice(-79), { cardId, fromStage: card.stageId, toStage: newStageId }]);

      return {
        ...prev,
        cards: prev.cards.map(c =>
          c.id === cardId
            ? {
                ...c,
                stageId: newStageId,
                publishedYear: newStageId === 'published' ? (publishedYear ?? new Date().getFullYear()) : c.publishedYear,
                updatedAt: new Date().toISOString(),
                history: [...c.history, historyEntry],
              }
            : c
        ),
      };
    });
  }, []);

  // Undo last move
  const undo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    setState(prev => ({
      ...prev,
      cards: prev.cards.map(c =>
        c.id === last.cardId
          ? { ...c, stageId: last.fromStage, updatedAt: new Date().toISOString() }
          : c
      ),
    }));

    setUndoStack(stack => stack.slice(0, -1));
  }, [undoStack]);

  // Move to bin
  const moveToBin = useCallback((cardId: string, reason = '') => {
    setState(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      const binItem: BinItem = {
        id: `b_${Math.random().toString(36).slice(2, 10)}`,
        title: card.title,
        reason,
        binnedAt: new Date().toISOString(),
        fromStageId: card.stageId,
        card,
      };

      return {
        ...prev,
        cards: prev.cards.filter(c => c.id !== cardId),
        bin: [...prev.bin, binItem],
      };
    });
  }, []);

  // Restore from bin
  const restoreFromBin = useCallback((binId: string) => {
    setState(prev => {
      const binItem = prev.bin.find(b => b.id === binId);
      if (!binItem?.card) return prev;

      return {
        ...prev,
        cards: [...prev.cards, { ...binItem.card, stageId: binItem.fromStageId }],
        bin: prev.bin.filter(b => b.id !== binId),
      };
    });
  }, []);

  // Delete from bin
  const deleteFromBin = useCallback((binId: string) => {
    setState(prev => ({
      ...prev,
      bin: prev.bin.filter(b => b.id !== binId),
    }));
  }, []);

  // Clear all bin
  const clearBin = useCallback(() => {
    setState(prev => ({
      ...prev,
      bin: [],
    }));
  }, []);

  // Clear all publications
  const clearAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      cards: [],
      bin: [],
    }));
    setUndoStack([]);
  }, []);

  // Reset to demo/template publications
  const resetToDemo = useCallback(() => {
    const freshState = createEmptyState();
    setState(prev => ({
      ...prev,
      cards: freshState.cards,
      bin: [],
    }));
    setUndoStack([]);
  }, []);

  // Duplicate publication
  const duplicatePublication = useCallback((cardId: string) => {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return null;

    const newPub: Publication = {
      ...card,
      id: `c_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`,
      title: `${card.title} (copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
    };

    setState(prev => ({
      ...prev,
      cards: [...prev.cards, newPub],
    }));

    return newPub;
  }, [state.cards]);

  // Get card by ID
  const getCard = useCallback((id: string) => {
    return state.cards.find(c => c.id === id);
  }, [state.cards]);

  // Update board
  const updateBoard = useCallback((updates: Partial<typeof state.board>) => {
    setState(prev => ({
      ...prev,
      board: { ...prev.board, ...updates, updatedAt: new Date().toISOString() },
    }));
  }, []);

  return {
    state,
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
  };
}
