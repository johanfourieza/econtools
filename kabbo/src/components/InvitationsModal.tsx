import { useState, useEffect } from 'react';
import { X, Check, XIcon, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  publication_id: string;
  publication_title: string;
  inviter_name: string;
  role: 'viewer' | 'editor';
  created_at: string;
}

interface InvitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvitationAccepted: () => void;
}

export function InvitationsModal({ isOpen, onClose, onInvitationAccepted }: InvitationsModalProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
    }
  }, [isOpen]);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      // Use the secure RPC function that bypasses RLS restrictions
      // This allows pending collaborators to see publication titles
      const { data, error } = await supabase.rpc('get_pending_invitations');

      if (error) throw error;

      const mappedInvitations: Invitation[] = (data || []).map((inv: any) => ({
        id: inv.id,
        publication_id: inv.publication_id,
        publication_title: inv.publication_title,
        inviter_name: inv.owner_name,
        role: inv.role as 'viewer' | 'editor',
        created_at: inv.created_at,
      }));

      setInvitations(mappedInvitations);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
      toast.error('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (invitationId: string, accept: boolean) => {
    setProcessingId(invitationId);
    try {
      const { error } = await supabase
        .from('publication_collaborators')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      toast.success(accept ? 'Invitation accepted!' : 'Invitation declined');
      
      if (accept) {
        onInvitationAccepted();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to respond to invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-foreground/20 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border rounded-xl shadow-lg z-50 animate-fade-in">
        <header className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold">Collaboration Invitations</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="p-4 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No pending invitations
            </p>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div 
                  key={invitation.id}
                  className="p-3 bg-secondary/30 rounded-lg border border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm truncate">
                        {invitation.publication_title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        From {invitation.inviter_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded capitalize">
                          {invitation.role}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(invitation.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleResponse(invitation.id, false)}
                        disabled={processingId === invitation.id}
                      >
                        {processingId === invitation.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XIcon className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleResponse(invitation.id, true)}
                        disabled={processingId === invitation.id}
                      >
                        {processingId === invitation.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Accept invitations to view or edit publications shared with you
          </p>
        </footer>
      </div>
    </>
  );
}
