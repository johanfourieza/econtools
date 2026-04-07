import { WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  className?: string;
}

export function OfflineIndicator({ 
  isOnline, 
  isSyncing, 
  pendingCount,
  className 
}: OfflineIndicatorProps) {
  // Don't show anything if online with no pending changes
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all duration-300',
        isOnline 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-destructive text-destructive-foreground',
        className
      )}
    >
      {isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Syncing...</span>
        </>
      ) : !isOnline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-medium">
            Offline
            {pendingCount > 0 && ` • ${pendingCount} pending`}
          </span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudOff className="w-4 h-4" />
          <span className="text-sm font-medium">
            {pendingCount} change{pendingCount > 1 ? 's' : ''} to sync
          </span>
        </>
      ) : null}
    </div>
  );
}
