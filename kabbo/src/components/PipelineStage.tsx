import { useState } from 'react';
import { Stage, Publication, STAGE_COLORS } from '@/types/publication';
import { PublicationCard } from './PublicationCard';
import { Archive } from 'lucide-react';

interface PresenceUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  viewingPublicationId: string | null;
  lastSeen: string;
}

interface PipelineStageProps {
  stage: Stage;
  stageIndex: number;
  cards: Publication[];
  totalCards: number;
  hasFilters: boolean;
  onCardClick: (id: string) => void;
  onCardDrop: (cardId: string) => void;
  getViewersForPublication?: (publicationId: string) => PresenceUser[];
}

export function PipelineStage({
  stage,
  stageIndex,
  cards,
  totalCards,
  hasFilters,
  onCardClick,
  onCardDrop,
  getViewersForPublication,
}: PipelineStageProps) {
  const stageColor = STAGE_COLORS[stageIndex % STAGE_COLORS.length];
  // Shelved papers are tucked under the column behind a one-line toggle so
  // the board shows live work only.
  const [showShelved, setShowShelved] = useState(false);
  const shelved = cards.filter(c => c.disposition === 'shelved');
  const live = cards.filter(c => c.disposition !== 'shelved');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('over');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('over');
    const cardId = e.dataTransfer.getData('text/pubflow-card');
    if (cardId) {
      onCardDrop(cardId);
    }
  };

  const handleCardDragStart = (cardId: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/pubflow-card', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const renderCard = (card: Publication) => (
    <PublicationCard
      key={card.id}
      publication={card}
      stageIndex={stageIndex}
      onClick={() => onCardClick(card.id)}
      onDragStart={handleCardDragStart(card.id)}
      viewers={getViewersForPublication?.(card.id) || []}
    />
  );

  // Funnel effect: early stages are wider, narrows toward end
  const totalStages = 6;
  const funnelRatio = 1 - (stageIndex / totalStages) * 0.5;
  // Smaller min-widths on mobile
  const minWidth = stageIndex === 0 ? 280 : stageIndex === 1 ? 240 : 180;
  const mobileMinWidth = stageIndex === 0 ? 200 : stageIndex === 1 ? 180 : 150;

  // Use window width to pick min-width (CSS media queries can't do inline styles)
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  const effectiveMinWidth = isMobileView ? mobileMinWidth : minWidth;

  return (
    <section 
      className="bg-card border border-border rounded-xl shadow-card flex flex-col overflow-hidden transition-all duration-300 h-full"
      style={{ 
        flex: `${funnelRatio} 1 0`,
        minWidth: `${effectiveMinWidth}px`,
      }}
    >
      <header className="p-2 md:p-3 flex items-start justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
          <div 
            className="stage-dot flex-shrink-0"
            style={{ 
              backgroundColor: `hsl(var(--${stageColor}))`,
              boxShadow: `0 0 0 3px hsl(var(--${stageColor}) / 0.2)`,
            }}
          />
          <h2 className="font-display font-semibold text-xs md:text-sm truncate">
            {stage.name}
          </h2>
        </div>
        <span className="text-muted-foreground text-[10px] md:text-xs flex-shrink-0">
          {hasFilters ? `${cards.length}/${totalCards}` : totalCards}
        </span>
      </header>

      <div
        className="dropzone flex-1 overflow-y-auto"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {live.length === 0 && shelved.length === 0 ? (
          <div className="text-muted-foreground/50 text-xs md:text-sm text-center py-6 md:py-8 border border-dashed border-border rounded-lg mx-2">
            Drop here
          </div>
        ) : (
          live.map(renderCard)
        )}
        {shelved.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowShelved(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              aria-expanded={showShelved}
            >
              <Archive className="w-3 h-3" />
              {showShelved ? 'Hide' : 'Show'} {shelved.length} shelved
            </button>
            {showShelved && shelved.map(renderCard)}
          </>
        )}
      </div>
    </section>
  );
}
