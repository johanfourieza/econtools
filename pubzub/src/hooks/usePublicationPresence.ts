import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  viewingPublicationId: string | null;
  lastSeen: string;
}

interface UsePublicationPresenceProps {
  userId?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
}

export function usePublicationPresence({
  userId,
  userDisplayName,
  userAvatarUrl,
}: UsePublicationPresenceProps) {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [currentPublicationId, setCurrentPublicationId] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const presenceChannel = supabase.channel('publication-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users: PresenceUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as any;
            if (key !== userId) {
              users.push({
                id: key,
                displayName: presence.displayName || 'Unknown',
                avatarUrl: presence.avatarUrl,
                viewingPublicationId: presence.viewingPublicationId,
                lastSeen: presence.lastSeen || new Date().toISOString(),
              });
            }
          }
        });
        
        setPresenceUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            displayName: userDisplayName,
            avatarUrl: userAvatarUrl,
            viewingPublicationId: null,
            lastSeen: new Date().toISOString(),
          });
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [userId, userDisplayName, userAvatarUrl]);

  const trackViewing = useCallback(async (publicationId: string | null) => {
    setCurrentPublicationId(publicationId);
    
    if (channel) {
      await channel.track({
        displayName: userDisplayName,
        avatarUrl: userAvatarUrl,
        viewingPublicationId: publicationId,
        lastSeen: new Date().toISOString(),
      });
    }
  }, [channel, userDisplayName, userAvatarUrl]);

  const getViewersForPublication = useCallback((publicationId: string): PresenceUser[] => {
    return presenceUsers.filter(user => user.viewingPublicationId === publicationId);
  }, [presenceUsers]);

  const getAllOnlineCollaborators = useCallback((): PresenceUser[] => {
    return presenceUsers;
  }, [presenceUsers]);

  return {
    presenceUsers,
    currentPublicationId,
    trackViewing,
    getViewersForPublication,
    getAllOnlineCollaborators,
  };
}
