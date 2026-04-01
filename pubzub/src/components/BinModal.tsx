import { X, RotateCcw, Trash2 } from 'lucide-react';
import { BinItem } from '@/types/publication';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BinModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BinItem[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

export function BinModal({
  isOpen,
  onClose,
  items,
  onRestore,
  onDelete,
  onDeleteAll,
}: BinModalProps) {
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">Bin</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''} in the bin
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-2 py-2">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>The bin is empty</p>
            </div>
          ) : (
            items.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {item.title || 'Untitled'}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Binned {formatDate(item.binnedAt)}
                  </p>
                  {item.reason && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{item.reason}"
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRestore(item.id)}
                    title="Restore"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                    title="Delete permanently"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteAll}
            disabled={items.length === 0}
            className="text-destructive hover:text-destructive"
          >
            Delete all
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
