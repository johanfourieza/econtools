import { useState, useEffect } from 'react';
import { Search, Plus, Undo2, BarChart3, BookOpen, FileText, Download, Users, Mail, Trash2, Printer, SlidersHorizontal, MoreHorizontal, ChevronDown, Columns3, Rows3, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

interface FilterBarProps {
  filters: {
    author: string;
    theme: string;
    grant: string;
    year: string;
    search: string;
  };
  filterOptions: {
    authors: string[];
    themes: string[];
    grants: string[];
    years: string[];
  };
  onFilterChange: (key: string, value: string) => void;
  onNewBubble: () => void;
  onTogglePublished: () => void;
  onToggleCollaborations: () => void;
  onOpenInvitations: () => void;
  onOpenBibtex: () => void;
  onExportBibtex: () => void;
  onExportPdf: () => void;
  onOpenStats: () => void;
  onUndo: () => void;
  onClearAll: () => void;
  onResetToDemo: () => void;
  canUndo: boolean;
  showPublished: boolean;
  showCollaborations: boolean;
  pendingInvitations: number;
  pipelineView?: 'vertical' | 'horizontal';
  onPipelineViewChange?: (view: 'vertical' | 'horizontal') => void;
  publishedYearsLimit?: number;
  onPublishedYearsLimitChange?: (limit: number) => void;
}

export function FilterBar({
  filters,
  filterOptions,
  onFilterChange,
  onNewBubble,
  onTogglePublished,
  onToggleCollaborations,
  onOpenInvitations,
  onOpenBibtex,
  onExportBibtex,
  onExportPdf,
  onOpenStats,
  onUndo,
  onClearAll,
  onResetToDemo,
  canUndo,
  showPublished,
  showCollaborations,
  pendingInvitations,
  pipelineView = 'vertical',
  onPipelineViewChange,
  publishedYearsLimit = 5,
  onPublishedYearsLimitChange,
}: FilterBarProps) {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const isMobile = useIsMobile();

  const hasActiveFilters = !!(filters.author || filters.theme || filters.grant || filters.year || filters.search);

  // ----- MOBILE LAYOUT -----
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {/* Top row: New + Search + Filters toggle + More menu */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={onNewBubble}
            size="sm"
            className="h-8 gap-1 bg-accent hover:bg-accent/90 text-accent-foreground text-xs px-2.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>

          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
              placeholder="Search..."
              className="pl-7 h-8 text-xs bg-card"
            />
          </div>

          <Button
            variant={hasActiveFilters ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-2"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {hasActiveFilters && <span className="ml-1 text-xs">•</span>}
          </Button>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 relative">
                <MoreHorizontal className="h-3.5 w-3.5" />
                {pendingInvitations > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center">
                    {pendingInvitations}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onTogglePublished}>
                <BookOpen className="h-3.5 w-3.5 mr-2" />
                {showPublished ? 'Hide' : 'Show'} Published
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleCollaborations}>
                <Users className="h-3.5 w-3.5 mr-2" />
                {showCollaborations ? 'Hide' : 'Show'} Shared
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenInvitations}>
                <Mail className="h-3.5 w-3.5 mr-2" />
                Invitations
                {pendingInvitations > 0 && (
                  <span className="ml-auto text-destructive text-xs">{pendingInvitations}</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenBibtex}>
                <FileText className="h-3.5 w-3.5 mr-2" />
                Import BibTeX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportBibtex}>
                <Download className="h-3.5 w-3.5 mr-2" />
                Export BibTeX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportPdf}>
                <Printer className="h-3.5 w-3.5 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenStats}>
                <BarChart3 className="h-3.5 w-3.5 mr-2" />
                Analytics
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onUndo} disabled={!canUndo}>
                <Undo2 className="h-3.5 w-3.5 mr-2" />
                Undo
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowClearDialog(true)}
                className="text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Clear all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expandable filters */}
        {filtersExpanded && (
          <div className="grid grid-cols-2 gap-1.5 animate-fade-in">
            <Select value={filters.author} onValueChange={(v) => onFilterChange('author', v)}>
              <SelectTrigger className="h-8 text-xs bg-card">
                <span className="text-muted-foreground mr-1 text-[10px]">Author:</span>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {filterOptions.authors.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.theme} onValueChange={(v) => onFilterChange('theme', v)}>
              <SelectTrigger className="h-8 text-xs bg-card">
                <span className="text-muted-foreground mr-1 text-[10px]">Theme:</span>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {filterOptions.themes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.grant} onValueChange={(v) => onFilterChange('grant', v)}>
              <SelectTrigger className="h-8 text-xs bg-card">
                <span className="text-muted-foreground mr-1 text-[10px]">Grant:</span>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {filterOptions.grants.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.year} onValueChange={(v) => onFilterChange('year', v)}>
              <SelectTrigger className="h-8 text-xs bg-card">
                <span className="text-muted-foreground mr-1 text-[10px]">Year:</span>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                <SelectItem value="__none__">Unspecified</SelectItem>
                {filterOptions.years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Clear dialog (shared) */}
        <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all publications?</AlertDialogTitle>
              <AlertDialogDescription>
                Choose whether to reset to the template bubbles or clear everything completely. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { onResetToDemo(); setShowClearDialog(false); }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Reset to templates
              </AlertDialogAction>
              <AlertDialogAction
                onClick={() => { onClearAll(); setShowClearDialog(false); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ----- DESKTOP LAYOUT (unchanged) -----
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Co-author filter */}
      <Select value={filters.author} onValueChange={(v) => onFilterChange('author', v)}>
        <SelectTrigger className="w-[140px] h-9 text-xs bg-card">
          <span className="text-muted-foreground mr-1">Author:</span>
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All co-authors</SelectItem>
          {filterOptions.authors.map(a => (
            <SelectItem key={a} value={a}>{a}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Theme filter */}
      <Select value={filters.theme} onValueChange={(v) => onFilterChange('theme', v)}>
        <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
          <span className="text-muted-foreground mr-1">Theme:</span>
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All themes</SelectItem>
          {filterOptions.themes.map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Grant filter */}
      <Select value={filters.grant} onValueChange={(v) => onFilterChange('grant', v)}>
        <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
          <span className="text-muted-foreground mr-1">Grant:</span>
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All grants</SelectItem>
          {filterOptions.grants.map(g => (
            <SelectItem key={g} value={g}>{g}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year filter */}
      <Select value={filters.year} onValueChange={(v) => onFilterChange('year', v)}>
        <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
          <span className="text-muted-foreground mr-1">Year:</span>
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All years</SelectItem>
          <SelectItem value="__none__">Unspecified</SelectItem>
          {filterOptions.years.map(y => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
          placeholder="Search titles..."
          className="pl-8 h-9 w-[160px] text-xs bg-card"
        />
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onNewBubble}
            size="sm"
            className="h-9 gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground"
            data-onboarding="new-bubble"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New bubble</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>New publication (N)</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onTogglePublished}
            size="sm"
            className="h-9 gap-1.5 bg-warm hover:bg-warm/90 text-warm-foreground"
            data-onboarding="published"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{showPublished ? 'Hide' : 'Show'} Published</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Toggle published section (P)</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onToggleCollaborations}
            size="sm"
            variant={showCollaborations ? 'default' : 'outline'}
            className="h-9 gap-1.5"
            data-onboarding="collaboration"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{showCollaborations ? 'Hide' : 'Show'} Shared</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Toggle shared publications (C)</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onOpenInvitations}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 relative"
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Invitations</span>
            {pendingInvitations > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                {pendingInvitations}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{pendingInvitations > 0 ? `${pendingInvitations} pending invitations` : 'No pending invitations'}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onOpenBibtex}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Import BibTeX (⌘I)</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onExportBibtex}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export all as BibTeX</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onExportPdf}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export as PDF</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onOpenStats}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View analytics (S)</p>
        </TooltipContent>
      </Tooltip>

      {/* Published years limit */}
      {onPublishedYearsLimitChange && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{publishedYearsLimit}y</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Published years to display</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {[3, 5, 10, 15, 20].map((n) => (
              <DropdownMenuItem
                key={n}
                onClick={() => onPublishedYearsLimitChange(n)}
                className={publishedYearsLimit === n ? 'bg-accent' : ''}
              >
                Last {n} years
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* View toggle */}
      {onPipelineViewChange && (
        <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
          <Button
            variant={pipelineView === 'vertical' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onPipelineViewChange('vertical')}
          >
            <Columns3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={pipelineView === 'horizontal' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onPipelineViewChange('horizontal')}
          >
            <Rows3 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onUndo}
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!canUndo}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{canUndo ? 'Undo last move (⌘Z)' : 'Nothing to undo'}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setShowClearDialog(true)}
            variant="outline"
            size="sm"
            className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Clear all publications</p>
        </TooltipContent>
      </Tooltip>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all publications?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose whether to reset to the template bubbles or clear everything completely. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onResetToDemo();
                setShowClearDialog(false);
              }}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Reset to templates
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                onClearAll();
                setShowClearDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
