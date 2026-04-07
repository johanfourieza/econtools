import { Trash2 } from 'lucide-react';

interface BinDockProps {
  count: number;
  onClick: () => void;
  onDrop: (cardId: string) => void;
}

export function BinDock({ count, onClick, onDrop }: BinDockProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('ring-2', 'ring-destructive', 'ring-offset-2');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2');
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
      className="fixed bottom-3 left-3 md:left-1/2 md:bottom-4 md:-translate-x-[calc(100%+0.5rem)] z-30 flex items-center gap-2 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full bg-card/95 border border-border shadow-lg backdrop-blur-sm transition-all hover:shadow-xl hover:scale-105"
      title="Drag publications here to bin them"
    >
      <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
      </div>
      <div className="text-left">
        <div className="font-semibold text-xs md:text-sm">Bin</div>
        <div className="text-muted-foreground text-[10px] md:text-xs">{count} item{count !== 1 ? 's' : ''}</div>
      </div>
    </button>
  );
}
