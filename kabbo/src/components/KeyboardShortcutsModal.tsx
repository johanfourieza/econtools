import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const singleKeyShortcuts = KEYBOARD_SHORTCUTS.filter(s => !s.modifier);
  const modifierShortcuts = KEYBOARD_SHORTCUTS.filter(s => s.modifier);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Single key shortcuts */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Quick Actions
            </h4>
            <div className="space-y-1.5">
              {singleKeyShortcuts.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/50">
                  <span className="text-sm">{shortcut.description}</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-secondary rounded border border-border">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Modifier shortcuts */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              With {modKey} Key
            </h4>
            <div className="space-y-1.5">
              {modifierShortcuts.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/50">
                  <span className="text-sm">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-secondary rounded border border-border">
                      {modKey}
                    </kbd>
                    <span className="text-xs text-muted-foreground">+</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-secondary rounded border border-border">
                      {shortcut.key}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-secondary rounded border border-border">?</kbd> anytime to show this
        </p>
      </DialogContent>
    </Dialog>
  );
}
