import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { useSupabasePublications } from '@/hooks/useSupabasePublications';
import { useAuth } from '@/hooks/useAuth';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useTeams } from '@/hooks/useTeams';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useOnboarding } from '@/hooks/useOnboarding';
import { usePublicationPresence } from '@/hooks/usePublicationPresence';
import { AppHeader } from '@/components/AppHeader';
import { FilterBar } from '@/components/FilterBar';
import { InsightsPanel } from '@/components/InsightsPanel';
import { useInsights } from '@/hooks/useInsights';
import { useCoauthorMatchInsight } from '@/hooks/useCoauthorMatchInsight';
import { PipelineStage } from '@/components/PipelineStage';
import { HorizontalPipelineStage } from '@/components/HorizontalPipelineStage';
import { HorizontalYearStage } from '@/components/HorizontalYearStage';
import { YearStage } from '@/components/YearStage';
import { PublicationDrawer } from '@/components/PublicationDrawer';
import { BinModal } from '@/components/BinModal';
import { BinDock } from '@/components/BinDock';
import { PublishedDock } from '@/components/PublishedDock';
import { pickKabboQuote } from '@/data/kabboQuotes';
import { AnalyticsModal } from '@/components/AnalyticsModal';
import { BibtexImportModal, ParsedEntry } from '@/components/BibtexImportModal';
import { InvitationsModal } from '@/components/InvitationsModal';
import { ExportPdfModal, PrintHeader } from '@/components/ExportPdfModal';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { QuickStartGuide } from '@/components/QuickStartGuide';
import { OnboardingTooltip } from '@/components/OnboardingTooltip';
import { TeamsModal } from '@/components/TeamsModal';
import { TeamMemberPipeline } from '@/components/TeamMemberPipeline';
import { ONBOARDING_STEPS } from '@/hooks/useOnboarding';
import { downloadBibtex } from '@/lib/bibtex';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/components/OfflineIndicator';

const Index = () => {
  const { isAuthenticated, loading: authLoading, profile, user, signOut, refetchProfile } = useAuth();
  
  const {
    state,
    loading: pubsLoading,
    filters,
    setFilters,
    pipelineStages,
    filterOptions,
    getCardsForStage,
    publishedByYear,
    addPublication,
    addPublicationWithData,
    updatePublication,
    moveToStage,
    undo,
    canUndo,
    moveToBin,
    restoreFromBin,
    deleteFromBin,
    clearBin,
    clearAll,
    resetToDemo,
    duplicatePublication,
    getCard,
    isOnline,
    isSyncing,
    pendingCount: offlinePendingCount,
  } = useSupabasePublications();

  const { collaboratedPubs, pendingCount: invitationPendingCount, refetch: refetchCollaborations } = useCollaborations(user?.id);

  // Teams
  const { pendingInvitations: teamInvitations } = useTeams(user?.id);

  // Presence tracking
  const { trackViewing, getViewersForPublication, getAllOnlineCollaborators } = usePublicationPresence({
    userId: user?.id,
    userDisplayName: profile?.displayName,
    userAvatarUrl: profile?.avatarUrl,
  });

  const { toast } = useToast();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isBinOpen, setIsBinOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isBibtexOpen, setIsBibtexOpen] = useState(false);
  const [isInvitationsOpen, setIsInvitationsOpen] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isTeamsOpen, setIsTeamsOpen] = useState(false);
  const [viewingMember, setViewingMember] = useState<{ memberId: string; teamId: string } | null>(null);
  const [showPublished, setShowPublished] = useState(false);
  const [showCollaborations, setShowCollaborations] = useState(false);
  const [pipelineView, setPipelineView] = useState<'vertical' | 'horizontal'>(() => {
    return (localStorage.getItem('kabbo-pipeline-view') as 'vertical' | 'horizontal') || 'vertical';
  });
  const [publishedYearsLimit, setPublishedYearsLimit] = useState<number>(() => {
    const stored = localStorage.getItem('kabbo-published-years-limit');
    return stored ? parseInt(stored, 10) : 5;
  });

  // Onboarding
  const {
    hasCompletedOnboarding,
    tooltipsDismissed,
    showQuickStart,
    currentTooltipIndex,
    currentStep,
    nextTooltip,
    skipTooltips,
    openQuickStart,
    closeQuickStart,
  } = useOnboarding();

  // Smart Insights panel – rule-based cards surfaced between the FilterBar
  // and the pipeline grid. Reads `state.cards` only; no writes.
  const {
    insights: syncInsights,
    dismiss: dismissInsight,
    isExpanded: insightsExpanded,
    toggleExpanded: toggleInsightsExpanded,
  } = useInsights(state.cards);
  // Async sibling: co-authors on Kabbo count from a SECURITY DEFINER RPC.
  // Merged onto the sync list, then re-sorted by priority so it lands in the
  // expected visual slot.
  const asyncInsight = useCoauthorMatchInsight(state.cards);
  const insights = useMemo(
    () => {
      const combined = asyncInsight ? [...syncInsights, asyncInsight] : syncInsights;
      return combined.slice().sort((a, b) => b.priority - a.priority);
    },
    [syncInsights, asyncInsight],
  );

  // Filter published years by limit. The 'unknown' bucket is always retained
  // regardless of limit, so orphan rows with missing years are never hidden.
  const filteredPublishedByYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - publishedYearsLimit + 1;
    return publishedByYear.filter(({ year }) => year === 'unknown' || year >= minYear);
  }, [publishedByYear, publishedYearsLimit]);

  // Get all published cards for statistics
  const publishedCards = useMemo(() => 
    publishedByYear.flatMap(({ cards }) => cards),
    [publishedByYear]
  );

  const handleNewBubble = useCallback(async () => {
    const newPub = await addPublication('idea');
    if (newPub) {
      setSelectedCardId(newPub.id);
      toast({
        title: 'New publication created',
        description: 'Start by adding a title and details.',
      });
    }
  }, [addPublication, toast]);

  const handleTogglePublished = useCallback(() => {
    setShowPublished(prev => !prev);
  }, []);

  const handleOpenStats = useCallback(() => {
    setIsStatsOpen(true);
  }, []);

  const handleOpenBibtex = useCallback(() => {
    setIsBibtexOpen(true);
  }, []);

  const handleUndo = useCallback(() => {
    undo();
    toast({
      title: 'Undone',
      description: 'Last move has been reversed.',
    });
  }, [undo, toast]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedCardId(null);
    trackViewing(null);
  }, [trackViewing]);

  const handleOpenBin = useCallback(() => {
    setIsBinOpen(true);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setIsShortcutsOpen(true);
  }, []);

  const handleExportPdfOpen = useCallback(() => {
    setIsPdfExportOpen(true);
  }, []);

  const handleToggleCollaborations = useCallback(() => {
    setShowCollaborations(prev => !prev);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewBubble: handleNewBubble,
    onTogglePublished: handleTogglePublished,
    onOpenStats: handleOpenStats,
    onOpenBibtex: handleOpenBibtex,
    onUndo: canUndo ? handleUndo : undefined,
    onCloseDrawer: selectedCardId ? handleCloseDrawer : undefined,
    onOpenBin: handleOpenBin,
    onOpenHelp: handleOpenHelp,
    onExportPdf: handleExportPdfOpen,
    onToggleCollaborations: handleToggleCollaborations,
  });

  // Show loading state while checking auth or loading publications
  if (authLoading || pubsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        {pubsLoading && <p className="text-muted-foreground text-sm">Loading your publications...</p>}
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const selectedCard = selectedCardId ? getCard(selectedCardId) : null;

  const hasFilters = !!(filters.author || filters.theme || filters.grant || filters.year || filters.search);

  const handleFilterChange = (key: string, value: string) => {
    const newValue = value === '__all__' ? '' : value;
    setFilters(prev => ({ ...prev, [key]: newValue }));
  };

  const handleCardClick = (id: string) => {
    setSelectedCardId(id);
    trackViewing(id);
  };

  const handleStageCardDrop = (stageId: string) => (cardId: string) => {
    const card = getCard(cardId);
    const oldIndex = card ? pipelineStages.findIndex(s => s.id === card.stageId) : -1;
    const newIndex = pipelineStages.findIndex(s => s.id === stageId);
    const isForward = oldIndex >= 0 && newIndex > oldIndex;

    moveToStage(cardId, stageId);

    if (isForward) {
      toast({
        title: 'Congratulations!',
        description: `"${pickKabboQuote().text}" – ||kabbo`,
      });
    } else {
      const stageName = pipelineStages.find(s => s.id === stageId)?.name || stageId;
      toast({
        title: 'Publication moved',
        description: `Moved to ${stageName}`,
      });
    }
  };

  const handlePublishedDrop = (cardId: string, year: number | 'unknown') => {
    // Dropping onto the "Year unknown" bucket is a no-op for the year – it
    // means the user is moving a card into published without assigning one.
    const resolvedYear = year === 'unknown' ? undefined : year;
    moveToStage(cardId, 'published', resolvedYear);
    toast({
      title: 'Congratulations!',
      description: `"${pickKabboQuote().text}" – ||kabbo`,
    });
  };

  const handlePublishedDockDrop = (cardId: string) => {
    const card = getCard(cardId);
    const currentYear = new Date().getFullYear();
    const isAlreadyPublished = card?.stageId === 'published';

    moveToStage(cardId, 'published', currentYear);

    if (!isAlreadyPublished) {
      toast({
        title: 'Congratulations!',
        description: `"${pickKabboQuote().text}" – ||kabbo`,
      });
    }

    // Auto-show published section if hidden
    if (!showPublished) {
      setShowPublished(true);
    }
  };

  const handleBinDrop = (cardId: string) => {
    moveToBin(cardId);
    setSelectedCardId(null);
    toast({
      title: 'Moved to bin',
      description: 'You can restore it from the bin.',
    });
  };

  const handleDuplicate = async () => {
    if (!selectedCardId) return;
    const newPub = await duplicatePublication(selectedCardId);
    if (newPub) {
      setSelectedCardId(newPub.id);
      toast({
        title: 'Publication duplicated',
        description: 'A copy has been created.',
      });
    }
  };

  const handleMoveToBin = () => {
    if (!selectedCardId) return;
    moveToBin(selectedCardId);
    setSelectedCardId(null);
    toast({
      title: 'Moved to bin',
    });
  };

  const handleBibtexImport = async (entries: ParsedEntry[]) => {
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of entries) {
      // Never create a publication with no title – that's how orphan rows
      // used to accumulate in the Published column.
      if (!entry.title || !entry.title.trim()) {
        skipped++;
        continue;
      }

      const year = entry.year ? parseInt(entry.year, 10) : new Date().getFullYear();
      const stageId = entry.suggestedStage === 'draft' ? 'draft' : 'published';
      const outputType = entry.type === 'book'
        ? 'book' as const
        : entry.type === 'incollection' || entry.type === 'inbook'
          ? 'chapter' as const
          : 'journal' as const;

      // Atomic single-insert. The old flow (addPublication followed by
      // updatePublication) had a documented race where the update step
      // silently no-opped because it read a stale `publications` closure –
      // resulting in rows on disk with title='Untitled' and no year. This
      // path either succeeds in one DB call or returns an error; no
      // half-imported rows are ever left behind.
      const { pub, error } = await addPublicationWithData(stageId, {
        title: entry.title,
        authors: entry.authors,
        completionYear: entry.year,
        publishedYear: stageId === 'published' ? year : '',
        outputType,
        typeA: entry.journal || entry.publisher || '',
        typeB: entry.booktitle || '',
      });

      if (error || !pub) {
        console.error('BibTeX import: insert failed for entry', entry.title, error);
        failed++;
        continue;
      }
      imported++;
    }

    const totalSkipped = skipped + failed;
    toast({
      title: totalSkipped === 0
        ? `Imported ${imported} publication${imported === 1 ? '' : 's'}`
        : `Imported ${imported}, ${totalSkipped} not saved`,
      description: totalSkipped > 0
        ? `${skipped > 0 ? `${skipped} had no title.` : ''} ${failed > 0 ? `${failed} failed to save – check your network and retry.` : ''}`.trim()
        : undefined,
      variant: failed > 0 ? 'destructive' : undefined,
    });
  };

  const handleExportBibtex = () => {
    const allPubs = state.cards.filter(c => c.stageId === 'published');
    if (allPubs.length === 0) {
      toast({
        title: 'No publications to export',
        description: 'Add some published items first.',
      });
      return;
    }
    downloadBibtex(allPubs, 'kabbo-export.bib');
    toast({
      title: 'BibTeX exported',
      description: `Exported ${allPubs.length} publication${allPubs.length > 1 ? 's' : ''}.`,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background grain overflow-hidden text-sm md:text-base">
      <AppHeader 
        title={state.board.title} 
        subtitle={state.board.subtitle} 
        profile={profile}
        onSignOut={signOut}
        onProfileUpdated={refetchProfile}
        onOpenTeams={() => setIsTeamsOpen(true)}
        teamInvitationCount={teamInvitations.length}
      />

      {/* Print Header - only visible when printing */}
      <PrintHeader />

      <main className="flex-1 flex flex-col max-w-[1440px] w-full mx-auto px-2 py-2 md:px-4 md:py-4 relative z-10 overflow-hidden">
        {/* Filter Bar */}
        <div className="mb-2 md:mb-4 flex-shrink-0">
          <FilterBar
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={handleFilterChange}
            onNewBubble={handleNewBubble}
            onTogglePublished={handleTogglePublished}
            onToggleCollaborations={() => setShowCollaborations(prev => !prev)}
            onOpenInvitations={() => setIsInvitationsOpen(true)}
            onOpenBibtex={handleOpenBibtex}
            onExportBibtex={handleExportBibtex}
            onExportPdf={() => setIsPdfExportOpen(true)}
            onOpenStats={handleOpenStats}
            onUndo={handleUndo}
            onClearAll={clearAll}
            onResetToDemo={resetToDemo}
            canUndo={canUndo}
            showPublished={showPublished}
            showCollaborations={showCollaborations}
            pendingInvitations={invitationPendingCount}
            pipelineView={pipelineView}
            onPipelineViewChange={(view) => { setPipelineView(view); localStorage.setItem('kabbo-pipeline-view', view); }}
            publishedYearsLimit={publishedYearsLimit}
            onPublishedYearsLimitChange={(limit) => { setPublishedYearsLimit(limit); localStorage.setItem('kabbo-published-years-limit', String(limit)); }}
          />
        </div>

        {/* Smart Insights panel (Wave 1E) */}
        <InsightsPanel
          insights={insights}
          onDismiss={dismissInsight}
          isExpanded={insightsExpanded}
          onToggleExpanded={toggleInsightsExpanded}
        />

        {/* Pipeline Board - Vertical (column) view */}
        {pipelineView === 'vertical' && (
          <div data-pdf-pipeline data-onboarding="pipeline" className="flex-1 flex gap-1.5 md:gap-2 overflow-x-auto overflow-y-hidden pb-2 min-h-0">
            {pipelineStages.map((stage, index) => {
              const cards = getCardsForStage(stage.id);
              const totalCards = state.cards.filter(c => c.stageId === stage.id).length;
              return (
                <PipelineStage
                  key={stage.id}
                  stage={stage}
                  stageIndex={index}
                  cards={cards}
                  totalCards={totalCards}
                  hasFilters={hasFilters}
                  onCardClick={handleCardClick}
                  onCardDrop={handleStageCardDrop(stage.id)}
                  getViewersForPublication={getViewersForPublication}
                />
              );
            })}
          </div>
        )}

        {/* Pipeline Board - Horizontal (row) view */}
        {pipelineView === 'horizontal' && (
          <div data-pdf-pipeline data-onboarding="pipeline" className="flex-1 flex flex-col gap-2 overflow-y-auto pb-2 min-h-0">
            {pipelineStages.map((stage, index) => {
              const cards = getCardsForStage(stage.id);
              const totalCards = state.cards.filter(c => c.stageId === stage.id).length;
              return (
                <HorizontalPipelineStage
                  key={stage.id}
                  stage={stage}
                  stageIndex={index}
                  cards={cards}
                  totalCards={totalCards}
                  hasFilters={hasFilters}
                  onCardClick={handleCardClick}
                  onCardDrop={handleStageCardDrop(stage.id)}
                  getViewersForPublication={getViewersForPublication}
                />
              );
            })}
          </div>
        )}

        {/* Divider - only show when published section is visible */}
        {showPublished && (
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-4 flex-shrink-0" />
        )}

        {/* Published Section - collapsible */}
        {showPublished && (
          <div data-pdf-published className="flex-1 flex flex-col min-h-0">
            <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap flex-shrink-0">
              <h3 className="font-display font-semibold text-base">Published</h3>
              <p className="text-muted-foreground text-xs">
                Drag a publication below the line to file it by year
              </p>
            </div>

            {pipelineView === 'horizontal' ? (
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0 pb-16">
                {filteredPublishedByYear.map(({ year, cards }) => (
                  <HorizontalYearStage
                    key={year}
                    year={year}
                    cards={cards}
                    onCardClick={handleCardClick}
                    onCardDrop={handlePublishedDrop}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex gap-2 overflow-x-auto overflow-y-hidden min-h-0 pb-2">
                {filteredPublishedByYear.map(({ year, cards }) => (
                  <YearStage
                    key={year}
                    year={year}
                    cards={cards}
                    onCardClick={handleCardClick}
                    onCardDrop={handlePublishedDrop}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collaborations info - collaborations now appear directly in the pipeline columns above */}
        {showCollaborations && collaboratedPubs.length > 0 && (
          <div className="flex-shrink-0 pb-4">
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-4" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>
                {collaboratedPubs.length} shared publication{collaboratedPubs.length !== 1 ? 's' : ''} are shown in the pipeline above with a collaboration badge
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Offline Indicator */}
      <OfflineIndicator 
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={offlinePendingCount}
      />

      {/* Bin Dock */}
      <BinDock
        count={state.bin.length}
        onClick={() => setIsBinOpen(true)}
        onDrop={handleBinDrop}
      />

      {/* Published Dock */}
      <PublishedDock
        onClick={handleTogglePublished}
        onDrop={handlePublishedDockDrop}
      />

      {/* Publication Drawer */}
      <PublicationDrawer
        publication={selectedCard}
        stages={state.board.stages}
        isOpen={!!selectedCardId}
        onClose={handleCloseDrawer}
        onUpdate={(updates) => {
          if (selectedCardId) {
            updatePublication(selectedCardId, updates);
          }
        }}
        onDuplicate={handleDuplicate}
        onMoveToBin={handleMoveToBin}
        viewers={selectedCardId ? getViewersForPublication(selectedCardId) : []}
      />

      {/* Bin Modal */}
      <BinModal
        isOpen={isBinOpen}
        onClose={() => setIsBinOpen(false)}
        items={state.bin}
        onRestore={(id) => {
          restoreFromBin(id);
          toast({ title: 'Publication restored' });
        }}
        onDelete={(id) => {
          deleteFromBin(id);
        }}
        onDeleteAll={() => {
          clearBin();
          toast({ title: 'Bin cleared' });
        }}
      />

      {/* Analytics Modal */}
      <AnalyticsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        cards={state.cards}
        stages={pipelineStages}
        publishedCards={publishedCards}
      />

      {/* BibTeX Import Modal */}
      <BibtexImportModal
        isOpen={isBibtexOpen}
        onClose={() => setIsBibtexOpen(false)}
        onImport={handleBibtexImport}
        userDisplayName={profile?.displayName}
      />

      {/* Invitations Modal */}
      <InvitationsModal
        isOpen={isInvitationsOpen}
        onClose={() => setIsInvitationsOpen(false)}
        onInvitationAccepted={() => {
          refetchCollaborations();
          toast({ title: 'Invitation accepted' });
        }}
      />


      {/* PDF Export Modal */}
      <ExportPdfModal
        open={isPdfExportOpen}
        onOpenChange={setIsPdfExportOpen}
        userName={profile?.displayName}
        publications={state.cards}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
      />

      {/* Teams Modal */}
      <TeamsModal
        open={isTeamsOpen}
        onOpenChange={setIsTeamsOpen}
        userId={user?.id}
        onViewMember={(memberId, teamId) => {
          setViewingMember({ memberId, teamId });
        }}
      />

      {/* Team Member Pipeline View */}
      <TeamMemberPipeline
        open={!!viewingMember}
        onOpenChange={(open) => !open && setViewingMember(null)}
        memberId={viewingMember?.memberId || ''}
        teamId={viewingMember?.teamId || ''}
        viewerId={user?.id}
      />

      {/* Quick Start Guide */}
      <QuickStartGuide
        open={showQuickStart}
        onOpenChange={closeQuickStart}
        onShowShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Onboarding Tooltips */}
      {!tooltipsDismissed && !showQuickStart && currentStep && (
        <OnboardingTooltip
          step={currentStep}
          currentIndex={currentTooltipIndex}
          totalSteps={ONBOARDING_STEPS.length}
          onNext={nextTooltip}
          onSkip={skipTooltips}
          onDismiss={skipTooltips}
        />
      )}

      {/* Help Button (floating) - hidden on mobile to avoid dock overlap */}
      <Button
        variant="outline"
        size="icon"
        onClick={openQuickStart}
        className="fixed bottom-4 left-4 z-50 rounded-full h-10 w-10 shadow-lg bg-card hover:bg-secondary hidden md:flex"
        title="Quick Start Guide"
      >
        <HelpCircle className="w-5 h-5" />
      </Button>

      {/* Footer */}
      <footer className="mt-auto py-1.5 md:py-2 px-3 md:px-6 hidden md:block">
        <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
          <span>Kabbo v1.0.0</span>
          <span className="text-border">•</span>
          <Link 
            to="/about" 
            className="hover:text-foreground transition-colors"
          >
            About
          </Link>
        </div>
      </footer>

      <Toaster />
    </div>
  );
};

export default Index;
