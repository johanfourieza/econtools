// Team-related types for the collaboration system

export type TeamRole = 'admin' | 'member';
export type MemberStatus = 'pending' | 'accepted' | 'declined';
export type PipelineStage = 'idea' | 'draft' | 'submitted' | 'revise_resubmit' | 'resubmitted' | 'accepted' | 'published';

export interface Team {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  createdBy: string;
  createdAt: string;
  memberCount?: number;
  dashboardPublic?: boolean;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId?: string;
  role: TeamRole;
  status: MemberStatus;
  invitedEmail?: string;
  createdAt: string;
  hasDashboardAccess: boolean;
  // Joined from profiles
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  universityAffiliation?: string;
}

export interface VisibilitySettings {
  id: string;
  userId: string;
  teamId: string;
  minVisibleStage: PipelineStage;
  createdAt: string;
  updatedAt: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  invitedBy: string;
  invitedByName?: string;
  role: TeamRole;
  status: MemberStatus;
  createdAt: string;
}

// Stage order for visibility filtering
export const STAGE_ORDER: PipelineStage[] = [
  'idea',
  'draft',
  'submitted',
  'revise_resubmit',
  'resubmitted',
  'accepted',
  'published',
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  idea: 'Idea',
  draft: 'Draft',
  submitted: 'Submitted',
  revise_resubmit: 'Revise & Resubmit',
  resubmitted: 'Resubmitted',
  accepted: 'Accepted',
  published: 'Published',
};

export function getStageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isStageVisible(publicationStage: string, minVisibleStage: PipelineStage): boolean {
  const pubIndex = STAGE_ORDER.indexOf(publicationStage as PipelineStage);
  const minIndex = getStageIndex(minVisibleStage);
  return pubIndex >= minIndex;
}
