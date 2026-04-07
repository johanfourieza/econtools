import { Publication } from '@/types/publication';
import { PublicationCard } from './PublicationCard';

interface HorizontalYearStageProps {
  year: number;
  cards: Publication[];
  onCardClick: (id: string) => void;
  onCardDrop: (cardId: string, year: number) => void;
}

export function HorizontalYearStage({ year, cards, onCardClick, onCardDrop }: HorizontalYearStageProps) {
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
      onCardDrop(cardId, year);
    }
  };

  const handleCardDragStart = (cardId: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/pubflow-card', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Same row-rebalancing logic as HorizontalPipelineStage
  const COLS = 8;
  const rows: Publication[][] = [];
  if (cards.length <= COLS) {
    rows.push(cards);
  } else {
    const tempRows: Publication[][] = [];
    for (let i = 0; i < cards.length; i += COLS) {
      tempRows.push(cards.slice(i, i + COLS));
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
      <header className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="stage-dot flex-shrink-0"
            style={{
              backgroundColor: 'hsl(var(--published))',
              boxShadow: '0 0 0 3px hsl(var(--published) / 0.2)',
            }}
          />
          <h2 className="font-display font-semibold text-sm">{year}</h2>
        </div>
        <span className="text-muted-foreground text-xs flex-shrink-0">{cards.length}</span>
      </header>

      <div
        className="dropzone px-2 py-1.5"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {cards.length === 0 ? (
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
                      stageIndex={6}
                      onClick={() => onCardClick(card.id)}
                      onDragStart={handleCardDragStart(card.id)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
