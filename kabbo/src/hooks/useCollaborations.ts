import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Publication } from '@/types/publication';

interface CollaboratedPublication extends Publication {
  isCollaboration: true;
  ownerName?: string;
  myRole: 'viewer' | 'editor';
}

export function useCollaborations(userId: string | undefined) {
  const [collaboratedPubs, setCollaboratedPubs] = useState<CollaboratedPublication[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCollaborations = useCallback(async () => {
    if (!userId) {
      setCollaboratedPubs([]);
      setPendingCount(0);
      return;
    }

    setLoading(true);
    try {
      // Fetch accepted collaborations
      const { data: collabs, error: collabError } = await supabase
        .from('publication_collaborators')
        .select('publication_id, role')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (collabError) throw collabError;

      // Fetch pending count
      const { count } = await supabase
        .from('publication_collaborators')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending');

      setPendingCount(count || 0);

      if (!collabs || collabs.length === 0) {
        setCollaboratedPubs([]);
        setLoading(false);
        return;
      }

      // Fetch publication details for each collaboration
      const pubs: CollaboratedPublication[] = [];
      
      for (const collab of collabs) {
        const { data: pub } = await supabase
          .from('publications')
          .select('*')
          .eq('id', collab.publication_id)
          .single();

        if (pub) {
          // Get owner info
          const { data: owner } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', pub.owner_id)
            .single();

          pubs.push({
            id: pub.id,
            title: pub.title,
            authors: pub.authors?.join(', ') || '',
            stageId: pub.stage,
            completionYear: pub.target_year?.toString() || '',
            publishedYear: '',
            themes: pub.themes?.join(', ') || '',
            grants: pub.grants?.join(', ') || '',
            links: (pub.links || []).map((l: string) => {
              const [label, url] = l.split('|');
              return { label: label || '', url: url || l };
            }),
            collaborationLinks: [],
            outputType: (pub.output_type || 'journal') as any,
            notes: pub.notes || '',
            createdAt: pub.created_at,
            updatedAt: pub.updated_at,
            history: (pub.stage_history || []) as any,
            githubRepo: pub.github_repo || '',
            overleafLink: pub.overleaf_link || '',
            typeA: '',
            typeB: '',
            typeC: '',
            workingPaper: { on: false, series: '', number: '', url: '' },
            reminders: [],
            collaborators: [],
            isCollaboration: true,
            ownerName: owner?.display_name || 'Unknown',
            myRole: collab.role as 'viewer' | 'editor',
          });
        }
      }

      setCollaboratedPubs(pubs);
    } catch (error) {
      console.error('Error fetching collaborations:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCollaborations();
  }, [fetchCollaborations]);

  return {
    collaboratedPubs,
    pendingCount,
    loading,
    refetch: fetchCollaborations,
  };
}
