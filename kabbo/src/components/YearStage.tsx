import { Publication } from '@/types/publication';
import { PublicationCard } from './PublicationCard';

interface YearStageProps {
  year: number;
  cards: Publication[];
  onCardClick: (id: string) => void;
  onCardDrop: (cardId: string, year: number) => void;
}

export function YearStage({ year, cards, onCardClick, onCardDrop }: YearStageProps) {
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

  return (
    <section className="bg-card border border-border rounded-xl shadow-card flex flex-col min-w-[150px] flex-1 min-h-[30vh]">
      <header className="p-3 flex items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-sm">{year}</h2>
        <span className="text-muted-foreground text-xs">{cards.length}</span>
      </header>

      <div
        className="dropzone flex-1"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {cards.length === 0 ? (
          <div className="text-muted-foreground/50 text-sm text-center py-6 border border-dashed border-border rounded-lg">
            Drop here
          </div>
        ) : (
          cards.map(card => (
            <PublicationCard
              key={card.id}
              publication={card}
              stageIndex={5}
              onClick={() => onCardClick(card.id)}
              onDragStart={handleCardDragStart(card.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
