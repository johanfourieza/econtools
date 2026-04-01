import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QueuedOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: 'publications' | 'publication_bin';
  data?: any;
  filters?: { column: string; value: string };
  timestamp: number;
}

const QUEUE_STORAGE_KEY = 'pubzub_offline_queue';

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();
  const syncingRef = useRef(false);

  // Load queue from localStorage
  const getQueue = useCallback((): QueuedOperation[] => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  // Save queue to localStorage
  const saveQueue = useCallback((queue: QueuedOperation[]) => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    setPendingCount(queue.length);
  }, []);

  // Add operation to queue
  const queueOperation = useCallback((operation: Omit<QueuedOperation, 'id' | 'timestamp'>) => {
    const queue = getQueue();
    const newOp: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    
    // For updates, check if there's already an update for the same record
    // and merge them to avoid redundant operations
    if (operation.type === 'update' && operation.filters) {
      const existingIndex = queue.findIndex(
        q => q.type === 'update' && 
             q.table === operation.table && 
             q.filters?.column === operation.filters?.column &&
             q.filters?.value === operation.filters?.value
      );
      
      if (existingIndex >= 0) {
        // Merge with existing update
        queue[existingIndex] = {
          ...queue[existingIndex],
          data: { ...queue[existingIndex].data, ...operation.data },
          timestamp: Date.now(),
        };
        saveQueue(queue);
        return queue[existingIndex].id;
      }
    }
    
    // For deletes, remove any pending inserts or updates for the same record
    if (operation.type === 'delete' && operation.filters) {
      const filteredQueue = queue.filter(
        q => !(q.table === operation.table && 
               ((q.type === 'insert' && q.data?.id === operation.filters?.value) ||
                (q.type === 'update' && q.filters?.value === operation.filters?.value)))
      );
      
      // If an insert was removed, we don't need to queue the delete
      if (filteredQueue.length < queue.length) {
        const insertWasRemoved = queue.some(
          q => q.type === 'insert' && q.table === operation.table && q.data?.id === operation.filters?.value
        );
        if (insertWasRemoved) {
          saveQueue(filteredQueue);
          return null; // No need to sync this delete
        }
      }
    }
    
    queue.push(newOp);
    saveQueue(queue);
    return newOp.id;
  }, [getQueue, saveQueue]);

  // Process a single operation
  const processOperation = async (op: QueuedOperation): Promise<boolean> => {
    try {
      switch (op.type) {
        case 'insert': {
          const { error } = await (supabase
            .from(op.table) as any)
            .insert(op.data);
          if (error) throw error;
          break;
        }
        case 'update': {
          if (!op.filters) throw new Error('Update requires filters');
          const { error } = await (supabase
            .from(op.table) as any)
            .update(op.data)
            .eq(op.filters.column, op.filters.value);
          if (error) throw error;
          break;
        }
        case 'delete': {
          if (!op.filters) throw new Error('Delete requires filters');
          const { error } = await (supabase
            .from(op.table) as any)
            .delete()
            .eq(op.filters.column, op.filters.value);
          if (error) throw error;
          break;
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to process operation:', op, error);
      return false;
    }
  };

  // Sync all queued operations
  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    
    const queue = getQueue();
    if (queue.length === 0) return;
    
    syncingRef.current = true;
    setIsSyncing(true);
    
    let successCount = 0;
    const failedOps: QueuedOperation[] = [];
    
    // Process in order
    for (const op of queue) {
      const success = await processOperation(op);
      if (success) {
        successCount++;
      } else {
        failedOps.push(op);
      }
    }
    
    // Save any failed operations back to queue
    saveQueue(failedOps);
    
    syncingRef.current = false;
    setIsSyncing(false);
    
    if (successCount > 0) {
      toast({
        title: 'Synced',
        description: `${successCount} offline change${successCount > 1 ? 's' : ''} saved.`,
      });
    }
    
    if (failedOps.length > 0) {
      toast({
        title: 'Sync incomplete',
        description: `${failedOps.length} change${failedOps.length > 1 ? 's' : ''} failed to sync.`,
        variant: 'destructive',
      });
    }
    
    return successCount;
  }, [getQueue, saveQueue, toast]);

  // Online/offline event handlers
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back online',
        description: 'Syncing your changes...',
      });
      // Auto-sync when coming back online
      syncQueue();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'Offline',
        description: 'Changes will be saved when you reconnect.',
        variant: 'destructive',
      });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initialize pending count
    setPendingCount(getQueue().length);
    
    // Sync any pending operations on mount if online
    if (navigator.onLine) {
      syncQueue();
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue, toast, getQueue]);

  // Execute operation - either directly or queue if offline
  const executeOrQueue = useCallback(async (
    operation: Omit<QueuedOperation, 'id' | 'timestamp'>,
    directExecution: () => Promise<unknown>
  ): Promise<{ success: boolean; queued: boolean }> => {
    if (isOnline) {
      try {
        await directExecution();
        return { success: true, queued: false };
      } catch (error) {
        // If direct execution fails due to network, queue it
        if (error instanceof Error && 
            (error.message.includes('network') || error.message.includes('fetch'))) {
          queueOperation(operation);
          return { success: true, queued: true };
        }
        throw error;
      }
    } else {
      queueOperation(operation);
      return { success: true, queued: true };
    }
  }, [isOnline, queueOperation]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    queueOperation,
    syncQueue,
    executeOrQueue,
  };
}
