import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Publication } from '@/types/publication';

interface UseRealtimePublicationsOptions {
  onPublicationUpdate?: (publication: Partial<Publication> & { id: string }) => void;
  onPublicationInsert?: (publication: Partial<Publication> & { id: string }) => void;
  onPublicationDelete?: (id: string) => void;
}

export function useRealtimePublications(options: UseRealtimePublicationsOptions = {}) {
  const { onPublicationUpdate, onPublicationInsert, onPublicationDelete } = options;

  useEffect(() => {
    const channel = supabase
      .channel('publications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'publications',
        },
        (payload) => {
          console.log('Publication updated:', payload);
          const updated = payload.new as any;
          if (onPublicationUpdate) {
            onPublicationUpdate({
              id: updated.id,
              title: updated.title,
              authors: updated.authors?.join(', ') || '',
              themes: updated.themes?.join(', ') || '',
              grants: updated.grants?.join(', ') || '',
              completionYear: updated.target_year?.toString() || '',
              stageId: updated.stage,
              notes: updated.notes || '',
              updatedAt: updated.updated_at,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'publications',
        },
        (payload) => {
          console.log('Publication inserted:', payload);
          const inserted = payload.new as any;
          if (onPublicationInsert) {
            onPublicationInsert({
              id: inserted.id,
              title: inserted.title,
              stageId: inserted.stage,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'publications',
        },
        (payload) => {
          console.log('Publication deleted:', payload);
          const deleted = payload.old as { id: string };
          if (onPublicationDelete) {
            onPublicationDelete(deleted.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onPublicationUpdate, onPublicationInsert, onPublicationDelete]);
}
