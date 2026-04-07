import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Team, TeamMember, TeamWithMembers, VisibilitySettings, TeamRole, PipelineStage, TeamInvitation } from '@/types/team';

interface UseTeamsReturn {
  teams: Team[];
  loading: boolean;
  pendingInvitations: TeamInvitation[];
  createTeam: (name: string, description?: string) => Promise<Team | null>;
  updateTeam: (teamId: string, updates: Partial<Pick<Team, 'name' | 'description' | 'logoUrl' | 'dashboardPublic'>>) => Promise<boolean>;
  deleteTeam: (teamId: string) => Promise<boolean>;
  inviteMember: (teamId: string, email: string, role: TeamRole) => Promise<boolean>;
  removeMember: (teamId: string, memberId: string) => Promise<boolean>;
  updateMemberRole: (memberId: string, role: TeamRole) => Promise<boolean>;
  updateDashboardAccess: (memberId: string, hasAccess: boolean) => Promise<boolean>;
  acceptInvitation: (memberId: string) => Promise<boolean>;
  declineInvitation: (memberId: string) => Promise<boolean>;
  getTeamMembers: (teamId: string) => Promise<TeamMember[]>;
  getTeamWithMembers: (teamId: string) => Promise<TeamWithMembers | null>;
  refetch: () => Promise<void>;
}

export function useTeams(userId?: string): UseTeamsReturn {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch teams where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          teams!inner (
            id,
            name,
            description,
            logo_url,
            created_by,
            created_at,
            dashboard_public
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (memberError) throw memberError;

      // Get member counts for each team
      const teamIds = memberData?.map(m => (m.teams as any).id) || [];
      
      let memberCounts: Record<string, number> = {};
      if (teamIds.length > 0) {
        const { data: countData } = await supabase
          .from('team_members')
          .select('team_id')
          .in('team_id', teamIds)
          .eq('status', 'accepted');

        if (countData) {
          memberCounts = countData.reduce((acc, row) => {
            acc[row.team_id] = (acc[row.team_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      const teamsData: Team[] = memberData?.map(m => {
        const team = m.teams as any;
        return {
          id: team.id,
          name: team.name,
          description: team.description,
          logoUrl: team.logo_url,
          createdBy: team.created_by,
          createdAt: team.created_at,
          memberCount: memberCounts[team.id] || 1,
          dashboardPublic: team.dashboard_public ?? false,
        };
      }) || [];

      setTeams(teamsData);

      // Fetch pending invitations
      const { data: invitationData, error: invError } = await supabase
        .from('team_members')
        .select(`
          id,
          team_id,
          role,
          status,
          created_at,
          teams!inner (
            id,
            name,
            created_by
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (invError) throw invError;

      // Get inviter names
      const creatorIds = invitationData?.map(inv => (inv.teams as any).created_by) || [];
      let creatorNames: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', creatorIds);

        if (profileData) {
          creatorNames = profileData.reduce((acc, p) => {
            acc[p.id] = p.display_name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const invitations: TeamInvitation[] = invitationData?.map(inv => {
        const team = inv.teams as any;
        return {
          id: inv.id,
          teamId: team.id,
          teamName: team.name,
          invitedBy: team.created_by,
          invitedByName: creatorNames[team.created_by],
          role: inv.role as TeamRole,
          status: inv.status as 'pending',
          createdAt: inv.created_at,
        };
      }) || [];

      setPendingInvitations(invitations);
    } catch (error: any) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = useCallback(async (name: string, description?: string): Promise<Team | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      const newTeam: Team = {
        id: data.id,
        name: data.name,
        description: data.description,
        createdBy: data.created_by,
        createdAt: data.created_at,
        memberCount: 1,
      };

      setTeams(prev => [...prev, newTeam]);
      toast.success('Team created');
      return newTeam;
    } catch (error: any) {
      console.error('Error creating team:', error);
      toast.error(error.message || 'Failed to create team');
      return null;
    }
  }, [userId]);

  const updateTeam = useCallback(async (teamId: string, updates: Partial<Pick<Team, 'name' | 'description' | 'logoUrl' | 'dashboardPublic'>>): Promise<boolean> => {
    try {
      const updateData: Record<string, any> = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim() || null;
      if (updates.logoUrl !== undefined) updateData.logo_url = updates.logoUrl || null;
      if (updates.dashboardPublic !== undefined) updateData.dashboard_public = updates.dashboardPublic;

      const { error } = await supabase
        .from('teams')
        .update(updateData)
        .eq('id', teamId);

      if (error) throw error;

      setTeams(prev => prev.map(t => 
        t.id === teamId ? { ...t, ...updates } : t
      ));
      toast.success('Team updated');
      return true;
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast.error(error.message || 'Failed to update team');
      return false;
    }
  }, []);

  const deleteTeam = useCallback(async (teamId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      setTeams(prev => prev.filter(t => t.id !== teamId));
      toast.success('Team deleted');
      return true;
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast.error(error.message || 'Failed to delete team');
      return false;
    }
  }, []);

  const inviteMember = useCallback(async (teamId: string, email: string, role: TeamRole): Promise<boolean> => {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Check if user exists using secure RPC function
      const { data: userId } = await supabase
        .rpc('find_user_id_by_email', { _email: normalizedEmail })
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: userId || null,
          invited_email: normalizedEmail,
          role,
          status: 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This person is already a member or has a pending invitation');
          return false;
        }
        throw error;
      }

      toast.success(`Invitation sent to ${email}`);
      return true;
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast.error(error.message || 'Failed to send invitation');
      return false;
    }
  }, []);

  const removeMember = useCallback(async (teamId: string, memberId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member removed');
      return true;
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.message || 'Failed to remove member');
      return false;
    }
  }, []);

  const updateMemberRole = useCallback(async (memberId: string, role: TeamRole): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Role updated');
      return true;
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Failed to update role');
      return false;
    }
  }, []);

  const acceptInvitation = useCallback(async (memberId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status: 'accepted' })
        .eq('id', memberId);

      if (error) throw error;

      setPendingInvitations(prev => prev.filter(inv => inv.id !== memberId));
      await fetchTeams();
      toast.success('Invitation accepted');
      return true;
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast.error(error.message || 'Failed to accept invitation');
      return false;
    }
  }, [fetchTeams]);

  const declineInvitation = useCallback(async (memberId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status: 'declined' })
        .eq('id', memberId);

      if (error) throw error;

      setPendingInvitations(prev => prev.filter(inv => inv.id !== memberId));
      toast.success('Invitation declined');
      return true;
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      toast.error(error.message || 'Failed to decline invitation');
      return false;
    }
  }, []);

  const getTeamMembers = useCallback(async (teamId: string): Promise<TeamMember[]> => {
    try {
      // Use the secure view that hides invited_email from non-admins
      const { data, error } = await supabase
        .from('team_members_secure')
        .select(`
          id,
          team_id,
          user_id,
          role,
          status,
          invited_email,
          created_at,
          has_dashboard_access,
          profiles:user_id (
            display_name,
            avatar_url,
            university_affiliation
          )
        `)
        .eq('team_id', teamId)
        .neq('status', 'declined');

      if (error) throw error;

      return data?.map(m => ({
        id: m.id,
        teamId: m.team_id,
        userId: m.user_id || undefined,
        role: m.role as TeamRole,
        status: m.status as 'pending' | 'accepted',
        invitedEmail: m.invited_email || undefined,
        createdAt: m.created_at,
        hasDashboardAccess: m.has_dashboard_access,
        displayName: (m.profiles as any)?.display_name,
        email: m.invited_email || '',
        avatarUrl: (m.profiles as any)?.avatar_url,
        universityAffiliation: (m.profiles as any)?.university_affiliation,
      })) || [];
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
      return [];
    }
  }, []);

  const updateDashboardAccess = useCallback(async (memberId: string, hasAccess: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ has_dashboard_access: hasAccess })
        .eq('id', memberId);

      if (error) throw error;

      toast.success(hasAccess ? 'Dashboard access granted' : 'Dashboard access revoked');
      return true;
    } catch (error: any) {
      console.error('Error updating dashboard access:', error);
      toast.error(error.message || 'Failed to update dashboard access');
      return false;
    }
  }, []);

  const getTeamWithMembers = useCallback(async (teamId: string): Promise<TeamWithMembers | null> => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return null;

    const members = await getTeamMembers(teamId);
    return { ...team, members };
  }, [teams, getTeamMembers]);

  return {
    teams,
    loading,
    pendingInvitations,
    createTeam,
    updateTeam,
    deleteTeam,
    inviteMember,
    removeMember,
    updateMemberRole,
    updateDashboardAccess,
    acceptInvitation,
    declineInvitation,
    getTeamMembers,
    getTeamWithMembers,
    refetch: fetchTeams,
  };
}
