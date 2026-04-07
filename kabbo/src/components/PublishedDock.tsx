import { PartyPopper } from 'lucide-react';

interface PublishedDockProps {
  onClick: () => void;
  onDrop: (cardId: string) => void;
}

export function PublishedDock({ onClick, onDrop }: PublishedDockProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('ring-2', 'ring-published', 'ring-offset-2', 'scale-105');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-published', 'ring-offset-2', 'scale-105');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-published', 'ring-offset-2', 'scale-105');
    const cardId = e.dataTransfer.getData('text/pubflow-card');
    if (cardId) {
      onDrop(cardId);
    }
  };

  return (
    <button
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed bottom-3 right-3 md:left-1/2 md:bottom-4 md:right-auto md:translate-x-4 z-30 flex items-center gap-2 md:gap-2.5 px-3 md:px-5 py-2 md:py-2.5 rounded-full bg-published text-published-foreground border border-published shadow-lg backdrop-blur-sm transition-all hover:shadow-xl hover:scale-105 hover:brightness-110"
      title="Drag publications here to mark as published"
    >
      <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-published-foreground/20 flex items-center justify-center">
        <PartyPopper className="h-3.5 w-3.5 md:h-4 md:w-4" />
      </div>
      <div className="text-left">
        <div className="font-semibold text-xs md:text-sm">Published!</div>
        <div className="text-published-foreground/80 text-[10px] md:text-xs hidden md:block">Drop to celebrate</div>
      </div>
    </button>
  );
}
