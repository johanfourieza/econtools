import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, ArrowLeft, Printer, BarChart3, Filter, 
  Users, X, TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { STAGE_LABELS, STAGE_ORDER } from '@/types/team';
import type { PipelineStage, Team } from '@/types/team';
import { STAGE_COLORS } from '@/types/publication';
import { TeamAnalyticsView } from './TeamAnalyticsView';

interface TeamDashboardViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  isAdmin?: boolean;
}

interface WorkingPaper {
  isWorkingPaper?: boolean;
  journalTarget?: string;
  submissionDate?: string;
}

interface TeamPublication {
  id: string;
  title: string;
  stage: string;
  authors: string[];
  themes: string[];
  grants: string[];
  targetYear?: number;
  outputType?: string;
  workingPaper?: WorkingPaper;
  updatedAt: string;
  createdAt: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
}

// Stages to show (excluding 'idea' which is private)
const VISIBLE_STAGES = STAGE_ORDER.filter(s => s !== 'idea');

export function TeamDashboardView({ open, onOpenChange, team, isAdmin = false }: TeamDashboardViewProps) {
  const [publications, setPublications] = useState<TeamPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Filters
  const [themeFilter, setThemeFilter] = useState<string>('__all__');
  const [grantFilter, setGrantFilter] = useState<string>('__all__');
  const [yearFilter, setYearFilter] = useState<string>('__all__');

  useEffect(() => {
    if (!open || !team) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .rpc('get_team_all_publications', { _team_id: team.id });

        if (fetchError) {
          console.error('Error fetching team publications:', fetchError);
          setError('Unable to load team publications.');
          return;
        }

        if (!data) {
          setError('No access to team publications.');
          return;
        }

        const pubs = (data as any[]).map((p: any) => ({
          id: p.id,
          title: p.title,
          stage: p.stage,
          authors: p.authors || [],
          themes: p.themes || [],
          grants: p.grants || [],
          targetYear: p.targetYear,
          outputType: p.outputType,
          workingPaper: p.workingPaper || undefined,
          updatedAt: p.updatedAt,
          createdAt: p.createdAt,
          ownerId: p.ownerId,
          ownerName: p.ownerName || 'Unknown',
          ownerAvatar: p.ownerAvatar,
        }));

        setPublications(pubs);
      } catch (err) {
        console.error('Error:', err);
        setError('An error occurred while loading data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, team]);

  // Filter out Ideas - they are private
  const visiblePublications = useMemo(() => {
    return publications.filter(p => p.stage !== 'idea');
  }, [publications]);

  // Extract filter options
  const filterOptions = useMemo(() => {
    const themes = new Set<string>();
    const grants = new Set<string>();
    const years = new Set<string>();

    visiblePublications.forEach(pub => {
      pub.themes.forEach(t => themes.add(t));
      pub.grants.forEach(g => grants.add(g));
      if (pub.targetYear) years.add(pub.targetYear.toString());
    });

    return {
      themes: Array.from(themes).sort(),
      grants: Array.from(grants).sort(),
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
    };
  }, [visiblePublications]);

  // Apply filters
  const filteredPublications = useMemo(() => {
    return visiblePublications.filter(pub => {
      if (themeFilter !== '__all__' && !pub.themes.includes(themeFilter)) {
        return false;
      }
      if (grantFilter !== '__all__' && !pub.grants.includes(grantFilter)) {
        return false;
      }
      if (yearFilter !== '__all__' && pub.targetYear?.toString() !== yearFilter) {
        return false;
      }
      return true;
    });
  }, [visiblePublications, themeFilter, grantFilter, yearFilter]);

  // Group by stage
  const publicationsByStage = useMemo(() => {
    const grouped: Record<string, TeamPublication[]> = {};
    VISIBLE_STAGES.forEach(stage => {
      grouped[stage] = filteredPublications.filter(p => p.stage === stage);
    });
    return grouped;
  }, [filteredPublications]);

  const hasActiveFilters = themeFilter !== '__all__' || grantFilter !== '__all__' || yearFilter !== '__all__';

  const clearFilters = () => {
    setThemeFilter('__all__');
    setGrantFilter('__all__');
    setYearFilter('__all__');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const stageColors = ['#3b82f6', '#06b6d4', '#f59e0b', '#f97316', '#22c55e', '#10b981'];
    const activeFilters: string[] = [];
    if (themeFilter !== '__all__') activeFilters.push(`Theme: ${themeFilter}`);
    if (grantFilter !== '__all__') activeFilters.push(`Grant: ${grantFilter}`);
    if (yearFilter !== '__all__') activeFilters.push(`Year: ${yearFilter}`);
    
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${team.name} - Team Dashboard</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            color: #1a1a1a;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e5e5e5;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 { font-size: 24px; margin-bottom: 4px; }
          .header .subtitle { color: #666; font-size: 14px; }
          .header .date { text-align: right; color: #666; font-size: 14px; }
          .filters {
            background: #f9fafb;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-size: 12px;
          }
          .summary {
            display: flex;
            gap: 20px;
            margin-bottom: 24px;
          }
          .summary-item {
            text-align: center;
            padding: 12px 20px;
            background: #f9fafb;
            border-radius: 8px;
          }
          .summary-item .value { font-size: 28px; font-weight: 700; color: #8b5cf6; }
          .summary-item .label { font-size: 11px; color: #666; text-transform: uppercase; }
          .stage { margin-bottom: 24px; page-break-inside: avoid; }
          .stage-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
          }
          .stage-dot { width: 12px; height: 12px; border-radius: 50%; }
          .stage-name { font-weight: 600; font-size: 14px; }
          .badge { 
            background: #f3f4f6;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
          }
          .publications-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-left: 20px;
          }
          .publication {
            padding: 12px;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
          }
          .pub-title { font-weight: 500; margin-bottom: 4px; font-size: 13px; }
          .pub-authors { font-size: 12px; color: #666; }
          @media print {
            body { padding: 20px; }
            .publications-grid { grid-template-columns: repeat(2, 1fr); }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${team.name} - Team Dashboard</h1>
            <div class="subtitle">${team.description || 'Research Publications'}</div>
          </div>
          <div class="date">
            <div>Generated on</div>
            <div style="font-weight: 600;">${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        ${activeFilters.length > 0 ? `
          <div class="filters">
            <strong>Active Filters:</strong> ${activeFilters.join(' • ')}
          </div>
        ` : ''}

        <div class="summary">
          <div class="summary-item">
            <div class="value">${filteredPublications.length}</div>
            <div class="label">Publications</div>
          </div>
          <div class="summary-item">
            <div class="value">${filteredPublications.filter(p => p.stage === 'published').length}</div>
            <div class="label">Published</div>
          </div>
        </div>

        ${VISIBLE_STAGES.map((stage, idx) => {
          const pubs = publicationsByStage[stage] || [];
          if (pubs.length === 0) return '';
          return `
            <div class="stage">
              <div class="stage-header">
                <div class="stage-dot" style="background: ${stageColors[idx]};"></div>
                <span class="stage-name">${STAGE_LABELS[stage]}</span>
                <span class="badge">${pubs.length}</span>
              </div>
              <div class="publications-grid">
                ${pubs.map(pub => `
                  <div class="publication">
                    <div class="pub-title">${pub.title}</div>
                    <div class="pub-authors">${[pub.ownerName, ...pub.authors].join(', ')}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #999; font-size: 11px; text-align: center;">
          Generated by Kabbo · ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  {team.name} - Dashboard
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Team publications by stage (Ideas are private)
                </p>
              </div>
              {isAdmin && (
                <Button variant="default" size="sm" onClick={() => setShowAnalytics(true)} className="gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Analytics
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-destructive">{error}</p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filter:</span>
                </div>

                <Select value={themeFilter} onValueChange={setThemeFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Themes</SelectItem>
                    {filterOptions.themes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={grantFilter} onValueChange={setGrantFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-sm">
                    <SelectValue placeholder="Grant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Grants</SelectItem>
                    {filterOptions.grants.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-[100px] h-8 text-sm">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Years</SelectItem>
                    {filterOptions.years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                )}

                <div className="flex-1" />

                <Badge variant="outline" className="h-8 px-3">
                  {filteredPublications.length} publication{filteredPublications.length !== 1 ? 's' : ''}
                  {hasActiveFilters && ` (of ${visiblePublications.length})`}
                </Badge>
              </div>

              {/* Publications grid by stage */}
              <ScrollArea className="flex-1">
                <div className="space-y-6 pr-4 pb-4">
                  {VISIBLE_STAGES.map((stageId, stageIndex) => {
                    const pubs = publicationsByStage[stageId] || [];
                    if (pubs.length === 0) return null;
                    // Offset by 1 since we skip 'idea' (index 0)
                    const colorIndex = STAGE_ORDER.indexOf(stageId);
                    const stageColor = STAGE_COLORS[colorIndex] || 'stage-2';
                    
                    return (
                      <div key={stageId}>
                        <div className="flex items-center gap-2 mb-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `hsl(var(--${stageColor}))` }}
                          />
                          <h3 className="font-medium">
                            {STAGE_LABELS[stageId as PipelineStage]}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {pubs.length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 ml-5">
                          {pubs.map((pub) => (
                            <div
                              key={pub.id}
                              className="p-3 rounded-lg border bg-card hover:bg-accent/20 transition-colors"
                            >
                              <h4 className="font-medium line-clamp-2 text-sm">{pub.title}</h4>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {[pub.ownerName, ...pub.authors].join(', ')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {filteredPublications.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No publications match your filters</p>
                      {hasActiveFilters && (
                        <Button variant="link" onClick={clearFilters} className="mt-2">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {showAnalytics && (
        <TeamAnalyticsView
          open={showAnalytics}
          onOpenChange={setShowAnalytics}
          publications={publications}
          teamName={team.name}
        />
      )}
    </>
  );
}
