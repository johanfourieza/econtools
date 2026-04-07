import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Lightbulb, 
  ArrowRight, 
  GripVertical, 
  Users, 
  FileText, 
  BarChart3,
  Keyboard,
  Sparkles
} from 'lucide-react';
import { KabboLogo } from './KabboLogo';

interface QuickStartGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts?: () => void;
}

export function QuickStartGuide({ open, onOpenChange, onShowShortcuts }: QuickStartGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <KabboLogo size={32} />
            <span>Welcome to Kabbo!</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Intro */}
          <p className="text-sm text-muted-foreground">
            Kabbo helps you manage your research publications from initial idea to final publication. 
            Here's how to get started:
          </p>

          {/* Steps */}
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h4 className="font-medium text-sm">1. Create a Publication</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click <strong>New Bubble</strong> or press <kbd className="px-1 py-0.5 text-[10px] bg-secondary rounded">N</kbd> to 
                  create a new research idea. Add a title, co-authors, and notes.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <GripVertical className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h4 className="font-medium text-sm">2. Track Progress</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Drag publications between stages as they progress: <strong>Idea → Draft → Submitted → R&R → Accepted → Published</strong>
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h4 className="font-medium text-sm">3. Collaborate</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click on any publication to open its details. Invite co-authors by email and chat in real-time.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h4 className="font-medium text-sm">4. Add Details</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Link your Overleaf project, GitHub repo, data sources, and related papers. Everything in one place.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h4 className="font-medium text-sm">5. Analyse & Export</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View statistics about your pipeline, export to PDF for reporting, or import existing publications via BibTeX.
                </p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Pro Tips
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 mt-0.5 text-accent flex-shrink-0" />
                <span>Press <kbd className="px-1 py-0.5 text-[10px] bg-secondary rounded">?</kbd> anytime to see all keyboard shortcuts</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 mt-0.5 text-accent flex-shrink-0" />
                <span>Filter by author, theme, or grant using the dropdown menus</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 mt-0.5 text-accent flex-shrink-0" />
                <span>Toggle "Published" to see your completed works organised by year</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 mt-0.5 text-accent flex-shrink-0" />
                <span>Items moved to the Bin can be restored anytime</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                onOpenChange(false);
                onShowShortcuts?.();
              }}
              className="gap-1.5"
            >
              <Keyboard className="w-4 h-4" />
              View Shortcuts
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Get Started
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
