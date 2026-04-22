export interface WorkingPaper {
  on: boolean;
  series: string;
  number: string;
  url: string;
}

export interface Link {
  label: string;
  url: string;
}

export interface CollaborationLink {
  type: 'github' | 'overleaf' | 'prism' | 'custom';
  label?: string; // Used for custom types
  url: string;
}

export const COLLABORATION_LINK_TYPES = [
  { value: 'github', label: 'GitHub', icon: 'github' },
  { value: 'overleaf', label: 'Overleaf', icon: 'file-text' },
  { value: 'prism', label: 'Prism', icon: 'prism' },
  { value: 'custom', label: 'Custom...', icon: 'link' },
] as const;

export interface Reminder {
  id?: string;
  title: string;
  description?: string;
  dueDate: string;
  reminderType: 'deadline' | 'conference' | 'resubmission' | 'working_paper' | 'general';
  isCompleted: boolean;
}

export interface HistoryEntry {
  from: string;
  to: string;
  at: string;
}

export interface DataSource {
  name: string;
  url: string;
  description?: string;
}

export interface RelatedPaper {
  title: string;
  url?: string;
  relationship: 'cites' | 'cited-by' | 'related' | 'extends' | 'replicates';
}

export interface Collaborator {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  role: 'viewer' | 'editor';
  status: 'pending' | 'accepted' | 'declined';
}

export interface Publication {
  id: string;
  ownerId?: string;
  title: string;
  authors: string;
  themes: string;
  grants: string;
  completionYear: string;
  stageId: string;
  outputType: 'journal' | 'book' | 'chapter';
  typeA: string; // journal name or book publisher
  typeB: string; // book title (for chapters)
  typeC: string; // editors (for chapters)
  workingPaper: WorkingPaper;
  notes: string;
  links: Link[]; // Custom user-defined sections/links
  // Collaboration links (GitHub, Overleaf, Prism, custom)
  collaborationLinks: CollaborationLink[];
  // Legacy fields for backwards compatibility
  githubRepo?: string;
  overleafLink?: string;
  // Reminders attached to this publication
  reminders: Reminder[];
  // Collaborators on this publication
  collaborators: Collaborator[];
  // `'unknown'` is a sentinel used when a row is in the published stage but
  // has no target_year – it keeps the row visible in a dedicated "Year
  // unknown" bucket rather than silently filtered out. `''` means the row is
  // not in the published stage and therefore has no applicable year.
  publishedYear: number | '' | 'unknown';
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
  // Collaboration flags (set when this is a shared publication)
  isCollaboration?: boolean;
  myRole?: 'viewer' | 'editor';
}

export interface Stage {
  id: string;
  name: string;
}

export interface BinItem {
  id: string;
  title: string;
  reason: string;
  binnedAt: string;
  fromStageId: string;
  card: Publication | null;
}

export interface Board {
  title: string;
  subtitle: string;
  paletteId: string;
  stages: Stage[];
  createdAt: string;
  updatedAt: string;
}

export interface PubFlowState {
  board: Board;
  cards: Publication[];
  bin: BinItem[];
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  universityAffiliation?: string;
  googleScholarUrl?: string;
  personalWebsiteUrl?: string;
  orcidId?: string;
  // When true, new publications pre-fill the authors field with the user's
  // display name. Default true; opt-out via Profile settings.
  autoIncludeMeInAuthors?: boolean;
}

export const DEFAULT_STAGES: Stage[] = [
  { id: 'idea', name: 'Idea' },
  { id: 'draft', name: 'Draft' },
  { id: 'submitted', name: 'Submitted' },
  { id: 'revise_resubmit', name: 'Revise & Resubmit' },
  { id: 'resubmitted', name: 'Resubmitted' },
  { id: 'accepted', name: 'Accepted' },
  { id: 'published', name: 'Published' },
];

export const STAGE_COLORS = [
  'stage-1',
  'stage-2', 
  'stage-3',
  'stage-4',
  'stage-5',
  'stage-6',
  'stage-7',
] as const;

export const REMINDER_TYPES = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'conference', label: 'Conference' },
  { value: 'resubmission', label: 'Resubmission' },
  { value: 'working_paper', label: 'Working Paper' },
  { value: 'general', label: 'General' },
] as const;

export const RELATIONSHIP_TYPES = [
  { value: 'cites', label: 'Cites' },
  { value: 'cited-by', label: 'Cited By' },
  { value: 'related', label: 'Related' },
  { value: 'extends', label: 'Extends' },
  { value: 'replicates', label: 'Replicates' },
] as const;
