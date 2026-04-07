import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Team } from '@/types/team';
import { Loader2, Upload, Trash2, AlertTriangle, X } from 'lucide-react';

interface TeamEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  onUpdate: (teamId: string, updates: Partial<Pick<Team, 'name' | 'description' | 'logoUrl'>>) => Promise<boolean>;
  onDelete: (teamId: string) => Promise<boolean>;
}

export function TeamEditModal({ 
  open, 
  onOpenChange, 
  team, 
  onUpdate,
  onDelete 
}: TeamEditModalProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description || '');
  const [logoUrl, setLogoUrl] = useState(team.logoUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${team.id}/logo.${fileExt}`;

      // Delete existing logo first if present
      if (logoUrl) {
        const existingPath = logoUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('team-logos').remove([existingPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('team-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('team-logos')
        .getPublicUrl(fileName);

      // Add cache-busting query param
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setLogoUrl(newUrl);
      toast.success('Logo uploaded');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl) return;

    setIsUploading(true);
    try {
      const path = `${team.id}/logo.${logoUrl.split('.').pop()?.split('?')[0]}`;
      await supabase.storage.from('team-logos').remove([path]);
      setLogoUrl('');
      toast.success('Logo removed');
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setIsSubmitting(true);
    const success = await onUpdate(team.id, {
      name: name.trim(),
      description: description.trim(),
      logoUrl: logoUrl || undefined,
    });

    if (success) {
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    const success = await onDelete(team.id);
    if (success) {
      setShowDeleteConfirm(false);
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Logo Section */}
            <div className="space-y-3">
              <Label>Team Logo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20 border-2 border-dashed border-muted-foreground/30">
                  <AvatarImage src={logoUrl} alt={team.name} />
                  <AvatarFallback className="text-lg bg-primary/10">
                    {getInitials(name || team.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload Logo
                  </Button>
                  {logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={isUploading}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: Square image, max 2MB
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Robinson Lab"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="teamDescription">Description (optional)</Label>
              <Textarea
                id="teamDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the team..."
                rows={3}
              />
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-destructive/20">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-destructive">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deleting this team will remove all members and cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Team
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete "{team.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All team members will lose access, 
              and the team's visibility settings will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
