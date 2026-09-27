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

interface HorizontalPipelineStageProps {
  stage: Stage;
  stageIndex: number;
  cards: Publication[];
  totalCards: number;
  hasFilters: boolean;
  onCardClick: (id: string) => void;
  onCardDrop: (cardId: string) => void;
  getViewersForPublication?: (publicationId: string) => PresenceUser[];
}

export function HorizontalPipelineStage({
  stage,
  stageIndex,
  cards,
  totalCards,
  hasFilters,
  onCardClick,
  onCardDrop,
  getViewersForPublication,
}: HorizontalPipelineStageProps) {
  const stageColor = STAGE_COLORS[stageIndex % STAGE_COLORS.length];

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

  // Shelved papers sit behind a toggle under the row; the board shows live work.
  const [showShelved, setShowShelved] = useState(false);
  const shelved = cards.filter(c => c.disposition === 'shelved');
  const live = cards.filter(c => c.disposition !== 'shelved');

  // Split cards into rows of 8; if last row has < 4 cards, rebalance
  const COLS = 8;
  const rows: Publication[][] = [];
  if (live.length <= COLS) {
    rows.push(live);
  } else {
    const tempRows: Publication[][] = [];
    for (let i = 0; i < live.length; i += COLS) {
      tempRows.push(live.slice(i, i + COLS));
    }
    if (tempRows.length > 1) {
      const lastRow = tempRows[tempRows.length - 1];
      if (lastRow.length < 4) {
        const prevRow = tempRows[tempRows.length - 2];
        const toMove = 4 - lastRow.length;
        const moved = prevRow.splice(prevRow.length - toMove, toMove);
        tempRows[tempRows.length - 1] = [...moved, ...lastRow];
      }
    }
    rows.push(...tempRows);
  }

  return (
    <section className="bg-card border border-border rounded-xl shadow-card transition-all duration-300">
      {/* Stage header */}
      <header className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="stage-dot flex-shrink-0"
            style={{
              backgroundColor: `hsl(var(--${stageColor}))`,
              boxShadow: `0 0 0 3px hsl(var(--${stageColor}) / 0.2)`,
            }}
          />
          <h2 className="font-display font-semibold text-sm">{stage.name}</h2>
        </div>
        <span className="text-muted-foreground text-xs flex-shrink-0">
          {hasFilters ? `${cards.length}/${totalCards}` : totalCards}
        </span>
      </header>

      <div
        className="dropzone px-2 py-1.5"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {live.length === 0 && shelved.length === 0 ? (
          <div className="text-muted-foreground/50 text-sm text-center py-3 border border-dashed border-border rounded-lg">
            Drop publications here
          </div>
        ) : (
          <div className="flex flex-col items-center gap-[2px]">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex justify-center gap-[2px]">
                {row.map((card) => (
                  <div key={card.id} className="w-[140px] xl:w-[160px]">
                    <PublicationCard
                      publication={card}
                      stageIndex={stageIndex}
                      onClick={() => onCardClick(card.id)}
                      onDragStart={handleCardDragStart(card.id)}
                      viewers={getViewersForPublication?.(card.id) || []}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {shelved.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setShowShelved(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              aria-expanded={showShelved}
            >
              <Archive className="w-3 h-3" />
              {showShelved ? 'Hide' : 'Show'} {shelved.length} shelved
            </button>
            {showShelved && (
              <div className="flex flex-wrap justify-center gap-[2px]">
                {shelved.map((card) => (
                  <div key={card.id} className="w-[140px] xl:w-[160px]">
                    <PublicationCard
                      publication={card}
                      stageIndex={stageIndex}
                      onClick={() => onCardClick(card.id)}
                      onDragStart={handleCardDragStart(card.id)}
                      viewers={getViewersForPublication?.(card.id) || []}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
