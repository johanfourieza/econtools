import { useEffect } from 'react';

interface ShortcutHandlers {
  onNewBubble?: () => void;
  onTogglePublished?: () => void;
  onOpenStats?: () => void;
  onOpenBibtex?: () => void;
  onUndo?: () => void;
  onCloseDrawer?: () => void;
  onOpenBin?: () => void;
  onOpenHelp?: () => void;
  onExportPdf?: () => void;
  onToggleCollaborations?: () => void;
}

export const KEYBOARD_SHORTCUTS = [
  { key: 'N', description: 'New publication', modifier: false },
  { key: 'P', description: 'Toggle published view', modifier: false },
  { key: 'S', description: 'Open statistics', modifier: false },
  { key: 'B', description: 'Open bin', modifier: false },
  { key: 'C', description: 'Toggle collaborations', modifier: false },
  { key: '?', description: 'Show this help', modifier: false },
  { key: 'Esc', description: 'Close drawer/modal', modifier: false },
  { key: 'N', description: 'New publication', modifier: true },
  { key: 'Z', description: 'Undo last move', modifier: true },
  { key: 'I', description: 'Import BibTeX', modifier: true },
  { key: 'P', description: 'Export PDF', modifier: true },
];

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        // Only allow Escape in inputs
        if (e.key === 'Escape' && handlers.onCloseDrawer) {
          handlers.onCloseDrawer();
        }
        return;
      }

      // Cmd/Ctrl + key shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            handlers.onNewBubble?.();
            break;
          case 'z':
            e.preventDefault();
            handlers.onUndo?.();
            break;
          case 'i':
            e.preventDefault();
            handlers.onOpenBibtex?.();
            break;
          case 'p':
            e.preventDefault();
            handlers.onExportPdf?.();
            break;
        }
        return;
      }

      // Single key shortcuts
      switch (e.key.toLowerCase()) {
        case 'n':
          handlers.onNewBubble?.();
          break;
        case 'p':
          handlers.onTogglePublished?.();
          break;
        case 's':
          handlers.onOpenStats?.();
          break;
        case 'b':
          handlers.onOpenBin?.();
          break;
        case 'c':
          handlers.onToggleCollaborations?.();
          break;
        case '?':
          handlers.onOpenHelp?.();
          break;
        case 'escape':
          handlers.onCloseDrawer?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
