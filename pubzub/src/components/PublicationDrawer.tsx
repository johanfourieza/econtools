import { X, Copy, Trash2, ExternalLink, Github, FileText, Plus, Users, Mail, Loader2, MessageCircle, Link2, Upload, File } from 'lucide-react';
import { Publication, Stage, DEFAULT_STAGES, Collaborator, CollaborationLink, COLLABORATION_LINK_TYPES } from '@/types/publication';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PublicationChat } from './PublicationChat';
import { PresenceIndicator } from './PresenceIndicator';

interface PresenceUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  viewingPublicationId: string | null;
  lastSeen: string;
}

interface PublicationDrawerProps {
  publication: Publication | null;
  stages: Stage[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Publication>) => void;
  onDuplicate: () => void;
  onMoveToBin: () => void;
  viewers?: PresenceUser[];
}

export function PublicationDrawer({
  publication,
  stages,
  isOpen,
  onClose,
  onUpdate,
  onDuplicate,
  onMoveToBin,
  viewers = [],
}: PublicationDrawerProps) {
  const [localPub, setLocalPub] = useState<Publication | null>(null);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newCollabEmail, setNewCollabEmail] = useState('');
  const [newCollabRole, setNewCollabRole] = useState<'viewer' | 'editor'>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  
  // Paper upload state
  const [isUploading, setIsUploading] = useState(false);
  const [paperFilePath, setPaperFilePath] = useState<string | null>(null);
  
  // Collaboration links state
  const [showCollabLinkForm, setShowCollabLinkForm] = useState(false);
  const [newCollabLinkType, setNewCollabLinkType] = useState<CollaborationLink['type']>('github');
  const [newCollabLinkUrl, setNewCollabLinkUrl] = useState('');
  const [newCollabLinkLabel, setNewCollabLinkLabel] = useState('');

  // Determine if this is a collaboration and if user can edit
  const isCollaboration = publication?.isCollaboration === true;
  const isViewer = isCollaboration && publication?.myRole === 'viewer';
  const canEdit = !isCollaboration || publication?.myRole === 'editor';

  useEffect(() => {
    if (publication) {
      setLocalPub({ ...publication });
      fetchCollaborators(publication.id);
      fetchPaperFile(publication.id);
    }
  }, [publication]);

  const fetchPaperFile = async (publicationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // List files in the publication's folder
      const { data, error } = await supabase.storage
        .from('papers')
        .list(`${user.id}/${publicationId}`);
      
      if (!error && data && data.length > 0) {
        setPaperFilePath(`${user.id}/${publicationId}/${data[0].name}`);
      } else {
        setPaperFilePath(null);
      }
    } catch (error) {
      console.error('Error fetching paper file:', error);
    }
  };

  const uploadPaper = async (file: File) => {
    if (!localPub) return;
    
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to upload files');
        return;
      }
      
      const filePath = `${user.id}/${localPub.id}/${file.name}`;
      
      // Delete existing file first if any
      if (paperFilePath) {
        await supabase.storage.from('papers').remove([paperFilePath]);
      }
      
      const { error } = await supabase.storage
        .from('papers')
        .upload(filePath, file, { upsert: true });
      
      if (error) throw error;
      
      setPaperFilePath(filePath);
      toast.success('Paper uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload paper');
    } finally {
      setIsUploading(false);
    }
  };

  const deletePaper = async () => {
    if (!paperFilePath) return;
    
    try {
      const { error } = await supabase.storage
        .from('papers')
        .remove([paperFilePath]);
      
      if (error) throw error;
      
      setPaperFilePath(null);
      toast.success('Paper deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete paper');
    }
  };

  const downloadPaper = async () => {
    if (!paperFilePath) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('papers')
        .download(paperFilePath);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = paperFilePath.split('/').pop() || 'paper';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error.message || 'Failed to download paper');
    }
  };

  const fetchCollaborators = async (publicationId: string) => {
    const { data, error } = await supabase
      .from('publication_collaborators')
      .select('id, user_id, invited_email, role, status, created_at')
      .eq('publication_id', publicationId);
    
    if (!error && data) {
      setCollaborators(data.map(c => ({
        id: c.id,
        userId: c.user_id,
        email: c.invited_email || '',
        role: c.role as 'viewer' | 'editor',
        status: c.status as 'pending' | 'accepted' | 'declined',
      })));
    }
  };

  const inviteCollaborator = async () => {
    if (!newCollabEmail.trim() || !localPub) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCollabEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to invite collaborators');
        return;
      }

      const trimmedEmail = newCollabEmail.trim().toLowerCase();

      // Check if trying to invite self using secure RPC
      const { data: isSelf } = await supabase
        .rpc('is_current_user_email', { _email: trimmedEmail });
      
      if (isSelf) {
        toast.error('You cannot invite yourself');
        setIsInviting(false);
        return;
      }

      // Check if already invited
      const existingCollab = collaborators.find(c => c.email.toLowerCase() === trimmedEmail);
      if (existingCollab) {
        toast.error('This email has already been invited');
        setIsInviting(false);
        return;
      }

      // Check if email belongs to an existing PubZub user using secure RPC
      const { data: existingUserId } = await supabase
        .rpc('find_user_id_by_email', { _email: trimmedEmail });

      // Insert invitation
      const { error } = await supabase
        .from('publication_collaborators')
        .insert({
          publication_id: localPub.id,
          user_id: existingUserId || null,
          invited_email: trimmedEmail,
          role: newCollabRole,
          status: 'pending',
        });

      if (error) throw error;

      const siteUrl = window.location.origin;
      
      if (existingUserId) {
        toast.success(
          <div className="space-y-2">
            <p>Invitation registered for {trimmedEmail}!</p>
            <p className="text-xs text-muted-foreground">They'll see the invitation when they log in.</p>
          </div>
        );
      } else {
        toast.success(
          <div className="space-y-2">
            <p>Invitation registered for {trimmedEmail}!</p>
            <p className="text-xs text-muted-foreground">Please send them this link to sign up:</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">{siteUrl}</code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(siteUrl);
                  toast.info('Link copied!');
                }}
                className="p-1 hover:bg-background rounded"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>,
          { duration: 10000 }
        );
      }
      setNewCollabEmail('');
      fetchCollaborators(localPub.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    try {
      const { error } = await supabase
        .from('publication_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
      toast.success('Collaborator removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove collaborator');
    }
  };

  if (!isOpen || !localPub) return null;

  const updateLocal = (updates: Partial<Publication>) => {
    setLocalPub(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleDone = () => {
    if (localPub) {
      onUpdate(localPub);
    }
    onClose();
  };

  // Custom sections/links
  const addLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    const newLinks = [...(localPub.links || []), { label: newLinkLabel.trim(), url: newLinkUrl.trim() }];
    updateLocal({ links: newLinks });
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const removeLink = (index: number) => {
    const newLinks = localPub.links.filter((_, i) => i !== index);
    updateLocal({ links: newLinks });
  };

  // Collaboration links
  const addCollaborationLink = () => {
    if (!newCollabLinkUrl.trim()) return;
    
    const newLink: CollaborationLink = {
      type: newCollabLinkType,
      url: newCollabLinkUrl.trim(),
      label: newCollabLinkType === 'custom' ? newCollabLinkLabel.trim() : undefined,
    };
    
    const currentLinks = localPub.collaborationLinks || [];
    updateLocal({ collaborationLinks: [...currentLinks, newLink] });
    
    setNewCollabLinkUrl('');
    setNewCollabLinkLabel('');
    setShowCollabLinkForm(false);
  };

  const removeCollaborationLink = (index: number) => {
    const newLinks = (localPub.collaborationLinks || []).filter((_, i) => i !== index);
    updateLocal({ collaborationLinks: newLinks });
  };

  const getCollabLinkIcon = (type: CollaborationLink['type']) => {
    switch (type) {
      case 'github': return <Github className="w-3 h-3" />;
      case 'overleaf': return <FileText className="w-3 h-3" />;
      case 'prism': return <Link2 className="w-3 h-3" />;
      default: return <Link2 className="w-3 h-3" />;
    }
  };

  const getCollabLinkLabel = (link: CollaborationLink) => {
    if (link.type === 'custom' && link.label) return link.label;
    const typeInfo = COLLABORATION_LINK_TYPES.find(t => t.value === link.type);
    return typeInfo?.label || link.type;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const allStages = stages.length > 0 ? stages : DEFAULT_STAGES;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-foreground/20 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <aside className="fixed top-0 right-0 w-full max-w-[420px] h-full bg-card border-l border-border shadow-lg z-50 flex flex-col animate-slide-in-right">
        <header className="p-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold text-base truncate flex-1">
                {localPub.title || 'New Publication'}
              </h3>
              {viewers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Viewing:</span>
                  <PresenceIndicator viewers={viewers} maxVisible={3} size="md" />
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Created {formatDate(localPub.createdAt)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0 h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Collaboration notice for viewers */}
          {isViewer && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                You're viewing this as a <strong className="text-primary">Viewer</strong>. Only editors can make changes.
              </span>
            </div>
          )}
          
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={localPub.title}
              onChange={(e) => canEdit && updateLocal({ title: e.target.value })}
              placeholder="Working title..."
              className="bg-secondary/30"
              disabled={!canEdit}
            />
          </div>

          {/* Co-authors */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Co-authors (comma-separated)</Label>
            <Input
              value={localPub.authors}
              onChange={(e) => canEdit && updateLocal({ authors: e.target.value })}
              placeholder="Robinson, Ozdaglar, Lensman"
              className="bg-secondary/30"
              disabled={!canEdit}
            />
          </div>

          {/* Stage & Year row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stage</Label>
              <Select value={localPub.stageId} onValueChange={(v) => canEdit && updateLocal({ stageId: v })} disabled={!canEdit}>
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allStages.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Completion year</Label>
              <Input
                type="number"
                value={localPub.completionYear}
                onChange={(e) => canEdit && updateLocal({ completionYear: e.target.value })}
                placeholder="e.g., 2026"
                min={1900}
                max={2100}
                className="bg-secondary/30"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Theme & Grant row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Theme (comma-separated)</Label>
              <Input
                value={localPub.themes}
                onChange={(e) => canEdit && updateLocal({ themes: e.target.value })}
                placeholder="AI, Institutions"
                className="bg-secondary/30"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Grant (comma-separated)</Label>
              <Input
                value={localPub.grants}
                onChange={(e) => canEdit && updateLocal({ grants: e.target.value })}
                placeholder="ERC, NRF"
                className="bg-secondary/30"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Output Type & Working Paper Section - MOVED UP */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <h4 className="font-display font-medium text-sm">Output Type</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={localPub.outputType} onValueChange={(v: 'journal' | 'book' | 'chapter') => updateLocal({ outputType: v })}>
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="journal">Journal article</SelectItem>
                    <SelectItem value="book">Book</SelectItem>
                    <SelectItem value="chapter">Chapter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {localPub.outputType === 'journal' ? 'Intended journal' : 
                   localPub.outputType === 'book' ? 'Publisher' : 'Book title'}
                </Label>
                <Input
                  value={localPub.typeA}
                  onChange={(e) => updateLocal({ typeA: e.target.value })}
                  placeholder="Optional"
                  className="bg-secondary/30"
                />
              </div>
            </div>
          </div>

          {/* Working Paper Section - MOVED UP */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <h4 className="font-display font-medium text-sm">Working Paper</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Also a working paper?</Label>
                <Select 
                  value={localPub.workingPaper.on ? 'yes' : 'no'} 
                  onValueChange={(v) => updateLocal({ 
                    workingPaper: { ...localPub.workingPaper, on: v === 'yes' } 
                  })}
                >
                  <SelectTrigger className="bg-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {localPub.workingPaper.on && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Series</Label>
                  <Input
                    value={localPub.workingPaper.series}
                    onChange={(e) => updateLocal({ 
                      workingPaper: { ...localPub.workingPaper, series: e.target.value } 
                    })}
                    placeholder="NBER Working Paper"
                    className="bg-secondary/30"
                  />
                </div>
              )}
            </div>
            {localPub.workingPaper.on && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Number</Label>
                  <Input
                    value={localPub.workingPaper.number}
                    onChange={(e) => updateLocal({ 
                      workingPaper: { ...localPub.workingPaper, number: e.target.value } 
                    })}
                    placeholder="w33892"
                    className="bg-secondary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Link</Label>
                  <Input
                    value={localPub.workingPaper.url}
                    onChange={(e) => updateLocal({ 
                      workingPaper: { ...localPub.workingPaper, url: e.target.value } 
                    })}
                    placeholder="https://..."
                    className="bg-secondary/30"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes - MOVED UP */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              value={localPub.notes}
              onChange={(e) => updateLocal({ notes: e.target.value })}
              placeholder="Short description or ideas..."
              className="bg-secondary/30 min-h-[80px]"
            />
          </div>

          {/* Work Space Section (formerly Collaboration) */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <h4 className="font-display font-medium text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Work Space
            </h4>
            
            {/* Paper Upload */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Paper File</Label>
              {paperFilePath ? (
                <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-md">
                  <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs truncate flex-1">{paperFilePath.split('/').pop()}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={downloadPaper}
                    title="Download"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={deletePaper}
                    title="Delete"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-md cursor-pointer hover:bg-secondary/20 transition-colors">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Upload paper (PDF, DOC, etc.)</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.tex"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadPaper(file);
                      e.target.value = '';
                    }}
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>
            
            {/* Project Links */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Project Links</Label>
            
            {/* Existing collaboration links */}
            {(localPub.collaborationLinks && localPub.collaborationLinks.length > 0) && (
              <div className="flex gap-2 flex-wrap">
                {localPub.collaborationLinks.map((link, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-secondary/50 rounded-md group"
                  >
                    {getCollabLinkIcon(link.type)}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {getCollabLinkLabel(link)}
                    </a>
                    <ExternalLink className="w-2.5 h-2.5" />
                    <button
                      onClick={() => removeCollaborationLink(i)}
                      className="opacity-0 group-hover:opacity-100 ml-1 hover:text-destructive transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new link form */}
            {showCollabLinkForm ? (
              <div className="space-y-2 p-2 bg-secondary/20 rounded-md">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newCollabLinkType} onValueChange={(v: CollaborationLink['type']) => setNewCollabLinkType(v)}>
                    <SelectTrigger className="bg-secondary/30 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLLABORATION_LINK_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newCollabLinkType === 'custom' && (
                    <Input
                      value={newCollabLinkLabel}
                      onChange={(e) => setNewCollabLinkLabel(e.target.value)}
                      placeholder="Label"
                      className="bg-secondary/30 text-xs"
                    />
                  )}
                </div>
                <Input
                  value={newCollabLinkUrl}
                  onChange={(e) => setNewCollabLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-secondary/30 text-xs"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCollabLinkForm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={addCollaborationLink} className="flex-1" disabled={!newCollabLinkUrl.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowCollabLinkForm(true)} className="w-full gap-1.5">
                <Plus className="w-3 h-3" />
                Add link
              </Button>
            )}
            </div>
          </div>

          {/* Collaborators Section */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <h4 className="font-display font-medium text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Invite Co-authors
            </h4>
            <div className="space-y-2">
              <Input
                type="email"
                value={newCollabEmail}
                onChange={(e) => setNewCollabEmail(e.target.value)}
                placeholder="colleague@university.edu"
                className="bg-secondary/30 text-xs"
              />
              <div className="flex gap-2">
                <Select value={newCollabRole} onValueChange={(v: 'viewer' | 'editor') => setNewCollabRole(v)}>
                  <SelectTrigger className="bg-secondary/30 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={inviteCollaborator}
                  disabled={isInviting || !newCollabEmail.trim()}
                  className="gap-1.5"
                >
                  {isInviting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Mail className="w-3 h-3" />
                  )}
                  Invite
                </Button>
              </div>
            </div>
            {collaborators.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Invited collaborators</Label>
                {collaborators.map((collab) => {
                  const isNotSignedUp = !collab.userId;
                  const statusLabel = isNotSignedUp 
                    ? 'awaiting signup' 
                    : collab.status;
                  const statusClass = isNotSignedUp
                    ? 'bg-orange-500/20 text-orange-600'
                    : collab.status === 'accepted' 
                      ? 'bg-green-500/20 text-green-600' 
                      : collab.status === 'declined'
                        ? 'bg-red-500/20 text-red-600'
                        : 'bg-yellow-500/20 text-yellow-600';
                  
                  return (
                    <div key={collab.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-md">
                      <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs truncate block">{collab.email}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground capitalize">{collab.role}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeCollaborator(collab.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Co-author Chat Section */}
          <PublicationChat publicationId={localPub.id} />

          {/* Custom Sections/Links */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <h4 className="font-display font-medium text-sm">Custom Sections</h4>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Section name"
                className="bg-secondary/30 text-xs"
              />
              <Input
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-secondary/30 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addLink} className="w-full gap-1.5">
              <Plus className="w-3 h-3" />
              Add section
            </Button>
            {localPub.links.length > 0 && (
              <div className="space-y-2">
                {localPub.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-md">
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline truncate flex-1"
                    >
                      {link.label}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeLink(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stage History */}
          {localPub.history.length > 0 && (
            <div className="border border-border rounded-lg p-3 space-y-3">
              <h4 className="font-display font-medium text-sm">Stage History</h4>
              <div className="space-y-2">
                {localPub.history.slice().reverse().map((entry, i) => {
                  const fromStage = allStages.find(s => s.id === entry.from)?.name || entry.from;
                  const toStage = allStages.find(s => s.id === entry.to)?.name || entry.to;
                  return (
                    <div key={i} className="p-2 bg-secondary/30 rounded-md">
                      <p className="text-xs text-muted-foreground">{formatDate(entry.at)}</p>
                      <p className="text-xs">{fromStage} → {toStage}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="p-3 border-t border-border flex items-center justify-between gap-2 bg-secondary/20">
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={onDuplicate} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </Button>
                <Button variant="outline" size="sm" onClick={onMoveToBin} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Bin
                </Button>
              </>
            )}
          </div>
          <Button onClick={handleDone} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Done
          </Button>
        </footer>
      </aside>
    </>
  );
}
