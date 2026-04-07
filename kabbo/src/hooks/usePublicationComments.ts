import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
export interface PublicationComment {
  id: string;
  publicationId: string;
  userId: string;
  content: string;
  createdAt: string;
  // Joined from profiles
  userDisplayName?: string;
}

export function usePublicationComments(publicationId: string | null) {
  const [comments, setComments] = useState<PublicationComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch comments for the publication
  const fetchComments = useCallback(async () => {
    if (!publicationId) {
      setComments([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('publication_comments')
        .select('id, publication_id, user_id, content, created_at')
        .eq('publication_id', publicationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles for the comments
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setComments(data.map(c => {
          const profile = profileMap.get(c.user_id);
          return {
            id: c.id,
            publicationId: c.publication_id,
            userId: c.user_id,
            content: c.content,
            createdAt: c.created_at,
            userDisplayName: profile?.display_name || undefined,
          };
        }));
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicationId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!publicationId) return;

    fetchComments();

    // Set up real-time subscription
    const channel = supabase
      .channel(`comments-${publicationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'publication_comments',
          filter: `publication_id=eq.${publicationId}`,
        },
        async (payload) => {
          console.log('New comment received:', payload);
          const newComment = payload.new as {
            id: string;
            publication_id: string;
            user_id: string;
            content: string;
            created_at: string;
          };

          // Fetch the user profile for the new comment
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', newComment.user_id)
            .maybeSingle();

          const comment: PublicationComment = {
            id: newComment.id,
            publicationId: newComment.publication_id,
            userId: newComment.user_id,
            content: newComment.content,
            createdAt: newComment.created_at,
            userDisplayName: profile?.display_name || undefined,
          };

          setComments(prev => {
            // Avoid duplicates
            if (prev.some(c => c.id === comment.id)) return prev;
            return [...prev, comment];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'publication_comments',
          filter: `publication_id=eq.${publicationId}`,
        },
        (payload) => {
          console.log('Comment deleted:', payload);
          const deletedId = (payload.old as { id: string }).id;
          setComments(prev => prev.filter(c => c.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [publicationId, fetchComments]);

  // Send a new comment with validation
  const sendComment = useCallback(async (content: string) => {
    const trimmedContent = content.trim();
    
    // Client-side validation matching database constraint
    if (!publicationId || !trimmedContent) {
      toast.error('Comment cannot be empty');
      return false;
    }
    
    if (trimmedContent.length > 5000) {
      toast.error('Comment must be 5000 characters or less');
      return false;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('publication_comments')
        .insert({
          publication_id: publicationId,
          user_id: user.id,
          content: trimmedContent,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending comment:', error);
      return false;
    } finally {
      setIsSending(false);
    }
  }, [publicationId]);

  // Delete a comment
  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('publication_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      setComments(prev => prev.filter(c => c.id !== commentId));
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
  }, []);

  return {
    comments,
    isLoading,
    isSending,
    sendComment,
    deleteComment,
    refetch: fetchComments,
  };
}
