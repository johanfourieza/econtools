import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTeams } from '@/hooks/useTeams';
import { useVisibilitySettings } from '@/hooks/useVisibilitySettings';
import type { Team, TeamMember, TeamRole, PipelineStage } from '@/types/team';
import { STAGE_LABELS, STAGE_ORDER } from '@/types/team';
import { TeamEditModal } from './TeamEditModal';
// TeamDashboardView removed - now using TeamWorkspace page
import { 
  Plus, 
  Users, 
  Settings, 
  Trash2, 
  Mail, 
  Crown, 
  UserPlus, 
  Check, 
  X,
  Loader2,
  ChevronRight,
  Eye,
  BarChart3,
  Pencil,
  Globe,
} from 'lucide-react';

interface TeamsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onViewMember?: (memberId: string, teamId: string) => void;
}

export function TeamsModal({ open, onOpenChange, userId, onViewMember }: TeamsModalProps) {
  const navigate = useNavigate();
  const {
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
  } = useTeams(userId);

  const { settings, updateVisibility, getSettingForTeam } = useVisibilitySettings(userId);

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // dashboardTeam state removed - using workspace navigation
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [currentUserHasDashboardAccess, setCurrentUserHasDashboardAccess] = useState(false);

  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load members when team is selected
  useEffect(() => {
    if (selectedTeam) {
      setMembersLoading(true);
      getTeamMembers(selectedTeam.id).then(members => {
        setTeamMembers(members);
        // Check if current user has dashboard access
        const currentMember = members.find(m => m.userId === userId);
        const isCreatorOrAdmin = selectedTeam.createdBy === userId || currentMember?.role === 'admin';
        // Dashboard access: admin OR (dashboard is public) OR (explicit dashboard access granted)
        const hasAccess = isCreatorOrAdmin || 
                         selectedTeam.dashboardPublic === true || 
                         currentMember?.hasDashboardAccess === true;
        setCurrentUserHasDashboardAccess(hasAccess);
        setMembersLoading(false);
      });
    }
  }, [selectedTeam, getTeamMembers, userId]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setIsSubmitting(true);
    const team = await createTeam(newTeamName, newTeamDescription);
    if (team) {
      setNewTeamName('');
      setNewTeamDescription('');
      setShowCreateForm(false);
      setSelectedTeam(team);
    }
    setIsSubmitting(false);
  };

  const handleInviteMember = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;
    setIsSubmitting(true);
    const success = await inviteMember(selectedTeam.id, inviteEmail, inviteRole);
    if (success) {
      setInviteEmail('');
      setInviteRole('member');
      setShowInviteForm(false);
      // Refresh members
      const members = await getTeamMembers(selectedTeam.id);
      setTeamMembers(members);
    }
    setIsSubmitting(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    const success = await removeMember(selectedTeam.id, memberId);
    if (success) {
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    const success = await deleteTeam(teamId);
    if (success) {
      setSelectedTeam(null);
      setDeleteConfirm(null);
    }
  };

  const handleVisibilityChange = async (teamId: string, stage: PipelineStage) => {
    await updateVisibility(teamId, stage);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || '?';
  };

  const isTeamAdmin = (team: Team) => {
    // Check if user is creator or has admin role in the team
    const currentMember = teamMembers.find(m => m.userId === userId);
    return team.createdBy === userId || currentMember?.role === 'admin';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Teams
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="teams" className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full">
              <TabsTrigger value="teams" className="flex-1">
                My Teams
                {teams.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{teams.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex-1">
                Invitations
                {pendingInvitations.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingInvitations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="visibility" className="flex-1">
                <Eye className="w-4 h-4 mr-1" />
                Visibility
              </TabsTrigger>
            </TabsList>

            {/* Teams Tab */}
            <TabsContent value="teams" className="flex-1 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : selectedTeam ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTeam(null)}
                    >
                      ← Back
                    </Button>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={selectedTeam.logoUrl} alt={selectedTeam.name} />
                      <AvatarFallback className="bg-primary/10">
                        {selectedTeam.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold">{selectedTeam.name}</h3>
                    {isTeamAdmin(selectedTeam) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditTeam(selectedTeam)}
                        title="Edit team"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {currentUserHasDashboardAccess && (
                      <div className="flex items-center gap-2 ml-auto">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/team/${selectedTeam.id}`);
                          }}
                        >
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Open Workspace
                        </Button>
                        {isTeamAdmin(selectedTeam) && (
                          <Badge variant="outline">
                            <Crown className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedTeam.description && (
                    <p className="text-sm text-muted-foreground">{selectedTeam.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Members</h4>
                    {isTeamAdmin(selectedTeam) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowInviteForm(true)}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Invite
                      </Button>
                    )}
                  </div>

                  {showInviteForm && (
                    <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                      <div className="space-y-2">
                        <Label htmlFor="inviteEmail">Email address</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          placeholder="colleague@university.edu"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleInviteMember}
                          disabled={isSubmitting || !inviteEmail.trim()}
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowInviteForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <ScrollArea className="h-[300px]">
                    {membersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={member.avatarUrl} />
                              <AvatarFallback>
                                {getInitials(member.displayName, member.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">
                                  {member.displayName || member.email}
                                </span>
                                {member.role === 'admin' && (
                                  <Crown className="w-3 h-3 text-amber-500" />
                                )}
                                {member.status === 'pending' && (
                                  <Badge variant="outline" className="text-xs">Pending</Badge>
                                )}
                                {member.role !== 'admin' && member.hasDashboardAccess && (
                                  <Badge variant="secondary" className="text-xs">
                                    <BarChart3 className="w-3 h-3 mr-1" />
                                    Dashboard
                                  </Badge>
                                )}
                              </div>
                              {member.universityAffiliation && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {member.universityAffiliation}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Role selector for team admins */}
                              {isTeamAdmin(selectedTeam) && member.userId !== userId && member.status === 'accepted' && (
                                <Select
                                  value={member.role}
                                  onValueChange={async (newRole: TeamRole) => {
                                    if (newRole !== member.role) {
                                      const success = await updateMemberRole(member.id, newRole);
                                      if (success) {
                                        setTeamMembers(prev => prev.map(m => 
                                          m.id === member.id ? { ...m, role: newRole } : m
                                        ));
                                      }
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[100px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              {/* View pipeline button */}
                              {member.userId && member.userId !== userId && member.status === 'accepted' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onViewMember?.(member.userId!, selectedTeam.id)}
                                >
                                  View Pipeline
                                  <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                              )}
                              {/* Dashboard access toggle - only for non-admin members */}
                              {isTeamAdmin(selectedTeam) && member.userId !== userId && member.role !== 'admin' && member.status === 'accepted' && (
                                <Button
                                  size="icon"
                                  variant={member.hasDashboardAccess ? "secondary" : "ghost"}
                                  title={member.hasDashboardAccess ? "Revoke dashboard access" : "Grant dashboard access"}
                                  onClick={async () => {
                                    const success = await updateDashboardAccess(member.id, !member.hasDashboardAccess);
                                    if (success) {
                                      setTeamMembers(prev => prev.map(m => 
                                        m.id === member.id ? { ...m, hasDashboardAccess: !m.hasDashboardAccess } : m
                                      ));
                                    }
                                  }}
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </Button>
                              )}
                              {/* Remove member button */}
                              {isTeamAdmin(selectedTeam) && member.userId !== userId && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="opacity-0 group-hover:opacity-100"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {isTeamAdmin(selectedTeam) && (
                    <div className="pt-4 border-t space-y-4">
                      {/* Dashboard visibility toggle */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Dashboard visible to all members</p>
                            <p className="text-xs text-muted-foreground">Analytics remains admin-only</p>
                          </div>
                        </div>
                        <Button
                          variant={selectedTeam.dashboardPublic ? "default" : "outline"}
                          size="sm"
                          onClick={async () => {
                            const newValue = !selectedTeam.dashboardPublic;
                            const success = await updateTeam(selectedTeam.id, { dashboardPublic: newValue });
                            if (success) {
                              // Update local state
                              setSelectedTeam({ ...selectedTeam, dashboardPublic: newValue });
                            }
                          }}
                        >
                          {selectedTeam.dashboardPublic ? 'Public' : 'Admins Only'}
                        </Button>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Manage team settings in edit mode
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditTeam(selectedTeam)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit Team
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {!showCreateForm ? (
                    <Button onClick={() => setShowCreateForm(true)} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Team
                    </Button>
                  ) : (
                    <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                      <div className="space-y-2">
                        <Label htmlFor="teamName">Team name</Label>
                        <Input
                          id="teamName"
                          placeholder="e.g., Robinson Lab, Economics Department"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamDescription">Description (optional)</Label>
                        <Textarea
                          id="teamDescription"
                          placeholder="Brief description of the team..."
                          value={newTeamDescription}
                          onChange={(e) => setNewTeamDescription(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCreateTeam}
                          disabled={isSubmitting || !newTeamName.trim()}
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Team'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewTeamName('');
                            setNewTeamDescription('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <ScrollArea className="h-[350px]">
                    {teams.length === 0 && !showCreateForm ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No teams yet</p>
                        <p className="text-sm">Create a team to collaborate with colleagues</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {teams.map((team) => (
                          <div
                            key={team.id}
                            onClick={() => setSelectedTeam(team)}
                            className="p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-9 h-9">
                                  <AvatarImage src={team.logoUrl} alt={team.name} />
                                  <AvatarFallback className="text-xs bg-primary/10">
                                    {team.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{team.name}</h4>
                                  {isTeamAdmin(team) && (
                                    <Crown className="w-3 h-3 text-amber-500" />
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                            {team.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1 ml-12">
                                {team.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground ml-12">
                              <Users className="w-3 h-3" />
                              {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            {/* Invitations Tab */}
            <TabsContent value="invitations" className="flex-1 min-h-0">
              <ScrollArea className="h-[400px]">
                {pendingInvitations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No pending invitations</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingInvitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{invitation.teamName}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Invited by {invitation.invitedByName || 'a team admin'}
                            </p>
                            <Badge variant="outline" className="mt-2 capitalize">
                              {invitation.role}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => acceptInvitation(invitation.id)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => declineInvitation(invitation.id)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Visibility Tab */}
            <TabsContent value="visibility" className="flex-1 min-h-0">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Control what stages of your research pipeline each team can see. 
                  Team members will only see publications at or after the stage you select.
                </p>

                <ScrollArea className="h-[350px]">
                  {teams.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Join a team to configure visibility settings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teams.map((team) => {
                        const currentSetting = getSettingForTeam(team.id);
                        const currentStage = currentSetting?.minVisibleStage || 'idea';
                        
                        return (
                          <div
                            key={team.id}
                            className="p-4 rounded-lg border bg-card"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <h4 className="font-medium">{team.name}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {currentStage === 'idea' 
                                    ? 'Showing all stages' 
                                    : `Showing ${STAGE_LABELS[currentStage]} and later`}
                                </p>
                              </div>
                              <Select
                                value={currentStage}
                                onValueChange={(v) => handleVisibilityChange(team.id, v as PipelineStage)}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STAGE_ORDER.map((stage) => (
                                    <SelectItem key={stage} value={stage}>
                                      {STAGE_LABELS[stage]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All team members will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteTeam(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team Dashboard removed - now using TeamWorkspace page */}

      {/* Team Edit Modal */}
      {editTeam && (
        <TeamEditModal
          open={!!editTeam}
          onOpenChange={(open) => {
            if (!open) {
              setEditTeam(null);
              // Refresh teams to get updated data
              if (selectedTeam) {
                const updatedTeam = teams.find(t => t.id === selectedTeam.id);
                if (updatedTeam) {
                  setSelectedTeam(updatedTeam);
                }
              }
            }
          }}
          team={editTeam}
          onUpdate={updateTeam}
          onDelete={async (teamId) => {
            const success = await deleteTeam(teamId);
            if (success) {
              setSelectedTeam(null);
            }
            return success;
          }}
        />
      )}
    </>
  );
}
