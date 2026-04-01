import { X, TrendingUp, Users, FileText, Calendar, Target, Award, BookOpen, Newspaper, Network, ChevronDown, ChevronUp, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState, useCallback } from 'react';
import { STAGE_LABELS, STAGE_ORDER } from '@/types/team';
import type { PipelineStage } from '@/types/team';
import { STAGE_COLORS } from '@/types/publication';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CoAuthorNetworkGraph } from './CoAuthorNetworkGraph';
import { exportToCSV, exportToExcel } from '@/lib/analyticsExport';
import { toast } from 'sonner';

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
}

interface TeamAnalyticsViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publications: TeamPublication[];
  teamName: string;
  embedded?: boolean;
}

interface CoAuthorLink {
  source: string;
  target: string;
  weight: number;
}

export function TeamAnalyticsView({ open, onOpenChange, publications, teamName, embedded = false }: TeamAnalyticsViewProps) {
  const [showAllJournals, setShowAllJournals] = useState(false);
  const [showAllCoAuthors, setShowAllCoAuthors] = useState(false);

  const stats = useMemo(() => {
    // Filter out ideas for most stats
    const visiblePubs = publications.filter(p => p.stage !== 'idea');

    // Stage distribution
    const stageDistribution = STAGE_ORDER.filter(s => s !== 'idea').map(stage => ({
      stage,
      label: STAGE_LABELS[stage],
      count: visiblePubs.filter(p => p.stage === stage).length,
    }));

    // Member distribution
    const memberCounts: Record<string, { name: string; count: number }> = {};
    visiblePubs.forEach(pub => {
      if (!memberCounts[pub.ownerId]) {
        memberCounts[pub.ownerId] = { name: pub.ownerName, count: 0 };
      }
      memberCounts[pub.ownerId].count++;
    });
    const topMembers = Object.entries(memberCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count);

    // Theme distribution
    const themeCounts: Record<string, number> = {};
    visiblePubs.forEach(pub => {
      pub.themes.forEach(t => {
        themeCounts[t] = (themeCounts[t] || 0) + 1;
      });
    });
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1]);

    // Grant coverage
    const withGrants = visiblePubs.filter(p => p.grants.length > 0).length;
    const grantCoverage = visiblePubs.length > 0 
      ? Math.round((withGrants / visiblePubs.length) * 100) 
      : 0;

    // Unique grants list
    const grantCounts: Record<string, number> = {};
    visiblePubs.forEach(pub => {
      pub.grants.forEach(g => {
        grantCounts[g] = (grantCounts[g] || 0) + 1;
      });
    });
    const grantsList = Object.entries(grantCounts).sort((a, b) => b[1] - a[1]);

    // Co-author network analysis
    const coAuthorPairs: Record<string, number> = {};
    const allAuthors = new Set<string>();
    let totalAuthorCount = 0;

    visiblePubs.forEach(pub => {
      const pubAuthors = [pub.ownerName, ...pub.authors];
      pubAuthors.forEach(a => allAuthors.add(a));
      totalAuthorCount += pubAuthors.length;

      // Generate pairs for co-authorship network
      for (let i = 0; i < pubAuthors.length; i++) {
        for (let j = i + 1; j < pubAuthors.length; j++) {
          const pair = [pubAuthors[i], pubAuthors[j]].sort().join('|||');
          coAuthorPairs[pair] = (coAuthorPairs[pair] || 0) + 1;
        }
      }
    });

    const coAuthorLinks: CoAuthorLink[] = Object.entries(coAuthorPairs)
      .map(([pair, weight]) => {
        const [source, target] = pair.split('|||');
        return { source, target, weight };
      })
      .sort((a, b) => b.weight - a.weight);

    const avgAuthors = visiblePubs.length > 0 
      ? (totalAuthorCount / visiblePubs.length).toFixed(1) 
      : '0';

    // Funnel metrics
    const draftCount = visiblePubs.filter(p => p.stage === 'draft').length;
    const submittedCount = visiblePubs.filter(p => p.stage === 'submitted').length;
    const publishedCount = visiblePubs.filter(p => p.stage === 'published').length;
    const inPipeline = visiblePubs.filter(p => p.stage !== 'published').length;

    const pipelineToPublished = inPipeline > 0 ? Math.round((publishedCount / (publishedCount + inPipeline)) * 100) : 0;

    // Target year distribution
    const yearCounts: Record<string, number> = {};
    visiblePubs.forEach(pub => {
      const year = pub.targetYear?.toString() || 'Not set';
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });

    // Output type distribution
    const outputCounts: Record<string, number> = {};
    visiblePubs.forEach(pub => {
      const type = pub.outputType || 'Unknown';
      outputCounts[type] = (outputCounts[type] || 0) + 1;
    });

    // Working paper stats
    const workingPaperCount = visiblePubs.filter(p => p.workingPaper?.isWorkingPaper).length;
    const workingPaperPercent = visiblePubs.length > 0 
      ? Math.round((workingPaperCount / visiblePubs.length) * 100) 
      : 0;

    // Journal targets distribution
    const journalCounts: Record<string, number> = {};
    visiblePubs.forEach(pub => {
      if (pub.workingPaper?.journalTarget) {
        journalCounts[pub.workingPaper.journalTarget] = (journalCounts[pub.workingPaper.journalTarget] || 0) + 1;
      }
    });
    const journalsList = Object.entries(journalCounts).sort((a, b) => b[1] - a[1]);

    return {
      total: visiblePubs.length,
      stageDistribution,
      topMembers,
      topThemes,
      withGrants,
      grantCoverage,
      grantsList,
      uniqueGrants: grantsList.length,
      uniqueAuthors: allAuthors.size,
      avgAuthors,
      coAuthorLinks,
      draftCount,
      submittedCount,
      publishedCount,
      inPipeline,
      pipelineToPublished,
      yearCounts,
      outputCounts,
      workingPaperCount,
      workingPaperPercent,
      journalsList,
    };
  }, [publications]);

  const handleExport = useCallback((format: 'csv' | 'excel') => {
    const exportData = {
      teamName,
      exportDate: new Date().toLocaleDateString(),
      total: stats.total,
      publishedCount: stats.publishedCount,
      workingPaperCount: stats.workingPaperCount,
      workingPaperPercent: stats.workingPaperPercent,
      uniqueAuthors: stats.uniqueAuthors,
      avgAuthors: stats.avgAuthors,
      grantCoverage: stats.grantCoverage,
      uniqueGrants: stats.uniqueGrants,
      stageDistribution: stats.stageDistribution,
      topMembers: stats.topMembers,
      topThemes: stats.topThemes,
      grantsList: stats.grantsList,
      journalsList: stats.journalsList,
      coAuthorLinks: stats.coAuthorLinks,
      yearCounts: stats.yearCounts,
      outputCounts: stats.outputCounts,
    };

    try {
      if (format === 'csv') {
        exportToCSV(exportData);
        toast.success('CSV exported successfully');
      } else {
        exportToExcel(exportData);
        toast.success('Excel file exported successfully');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export analytics');
    }
  }, [teamName, stats]);

  if (!open) return null;

  // Embedded mode: render content directly without overlay
  if (embedded) {
    return (
      <div className="space-y-6">
        {/* Export buttons */}
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            {teamName} Analytics
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />Excel
            </Button>
          </div>
        </div>
        <AnalyticsContent stats={stats} showAllJournals={showAllJournals} setShowAllJournals={setShowAllJournals} showAllCoAuthors={showAllCoAuthors} setShowAllCoAuthors={setShowAllCoAuthors} publications={publications} />
      </div>
    );
  }

  // Modal mode (original)
  return (
    <>
      <div 
        className="fixed inset-0 bg-foreground/20 z-50 animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[800px] md:max-h-[90vh] bg-card border border-border rounded-xl shadow-lg z-50 flex flex-col animate-scale-in overflow-hidden">
        <header className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="font-display font-semibold text-lg">{teamName} Analytics</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} className="gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />Excel
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <AnalyticsContent stats={stats} showAllJournals={showAllJournals} setShowAllJournals={setShowAllJournals} showAllCoAuthors={showAllCoAuthors} setShowAllCoAuthors={setShowAllCoAuthors} publications={publications} />
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

interface AnalyticsContentProps {
  stats: any;
  showAllJournals: boolean;
  setShowAllJournals: (v: boolean) => void;
  showAllCoAuthors: boolean;
  setShowAllCoAuthors: (v: boolean) => void;
  publications: TeamPublication[];
}

function AnalyticsContent({ stats, showAllJournals, setShowAllJournals, showAllCoAuthors, setShowAllCoAuthors, publications }: AnalyticsContentProps) {
  // "Who is working on what" summary
  const whoWorksOnWhat = useMemo(() => {
    const visiblePubs = publications.filter(p => p.stage !== 'idea');
    const memberMap: Record<string, { name: string; stages: Record<string, number>; journals: Set<string>; coAuthors: Set<string>; total: number }> = {};
    visiblePubs.forEach(pub => {
      if (!memberMap[pub.ownerId]) {
        memberMap[pub.ownerId] = { name: pub.ownerName, stages: {}, journals: new Set(), coAuthors: new Set(), total: 0 };
      }
      const m = memberMap[pub.ownerId];
      m.total++;
      m.stages[pub.stage] = (m.stages[pub.stage] || 0) + 1;
      if (pub.workingPaper?.journalTarget) m.journals.add(pub.workingPaper.journalTarget);
      pub.authors.forEach(a => m.coAuthors.add(a));
    });
    return Object.entries(memberMap)
      .map(([id, data]) => ({ id, ...data, journals: Array.from(data.journals), coAuthors: data.coAuthors.size }))
      .sort((a, b) => b.total - a.total);
  }, [publications]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-display font-bold text-foreground">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Publications</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-display font-bold text-accent">{stats.topMembers.length}</div>
          <div className="text-xs text-muted-foreground">Members</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-display font-bold text-foreground">{stats.publishedCount}</div>
          <div className="text-xs text-muted-foreground">Published</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-display font-bold text-foreground">{stats.workingPaperCount}</div>
          <div className="text-xs text-muted-foreground">Working Papers</div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-display font-bold text-foreground">{stats.uniqueAuthors}</div>
          <div className="text-xs text-muted-foreground">Co-authors</div>
        </div>
      </div>

      {/* Who is working on what */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Who is Working on What
        </h3>
        {whoWorksOnWhat.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">Member</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Active</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Draft</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Submitted</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">R&R</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Published</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">Co-authors</th>
                  <th className="text-left py-2 pl-2 font-medium text-muted-foreground text-xs">Target Journals</th>
                </tr>
              </thead>
              <tbody>
                {whoWorksOnWhat.map(member => (
                  <tr key={member.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-medium truncate max-w-[150px]">{member.name}</td>
                    <td className="py-2 px-2 text-center">{member.total}</td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{member.stages['draft'] || 0}</td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{(member.stages['submitted'] || 0) + (member.stages['resubmitted'] || 0)}</td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{member.stages['revise_resubmit'] || 0}</td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{member.stages['published'] || 0}</td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{member.coAuthors}</td>
                    <td className="py-2 pl-2 text-xs text-muted-foreground truncate max-w-[200px]">
                      {member.journals.length > 0 ? member.journals.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No data</p>
        )}
      </div>

      {/* Publication Funnel */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <h3 className="font-display font-medium text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          Publication Pipeline
        </h3>
        <div className="flex flex-col items-center gap-1">
          {stats.stageDistribution.map((item: any) => {
            const maxCount = Math.max(...stats.stageDistribution.map((s: any) => s.count), 1);
            const widthPercent = Math.max(15, (item.count / maxCount) * 100);
            const colorIndex = STAGE_ORDER.indexOf(item.stage as PipelineStage);
            return (
              <div
                key={item.stage}
                className="relative flex items-center justify-between px-4 transition-all duration-500"
                style={{
                  width: `${widthPercent}%`,
                  height: '32px',
                  background: `linear-gradient(90deg, hsl(var(--${STAGE_COLORS[colorIndex]}) / 0.2), hsl(var(--${STAGE_COLORS[colorIndex]}) / 0.3), hsl(var(--${STAGE_COLORS[colorIndex]}) / 0.2))`,
                  borderLeft: `3px solid hsl(var(--${STAGE_COLORS[colorIndex]}))`,
                  borderRight: `3px solid hsl(var(--${STAGE_COLORS[colorIndex]}))`,
                  minWidth: '120px',
                }}
              >
                <span className="text-xs font-medium">{item.label}</span>
                <span className="text-sm font-bold">{item.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column: Members & Themes */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-secondary/30 rounded-lg p-4">
          <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Contributors
          </h3>
          <div className="space-y-2">
            {stats.topMembers.slice(0, 6).map((member: any, i: number) => (
              <div key={member.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <span className="text-sm truncate">{member.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{member.count}</Badge>
              </div>
            ))}
            {stats.topMembers.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
          </div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-4">
          <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Research Themes
          </h3>
          <div className="space-y-2">
            {stats.topThemes.slice(0, 6).map(([theme, count]: [string, number]) => (
              <div key={theme} className="flex justify-between items-center">
                <span className="text-sm truncate">{theme}</span>
                <Badge variant="outline" className="text-xs">{count}</Badge>
              </div>
            ))}
            {stats.topThemes.length === 0 && <p className="text-xs text-muted-foreground">No themes tagged</p>}
          </div>
        </div>
      </div>

      {/* Co-Author Network Graph */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
          <Network className="w-4 h-4 text-muted-foreground" />
          Co-Author Network
          <span className="text-xs text-muted-foreground ml-2">
            ({stats.uniqueAuthors} unique authors, avg {stats.avgAuthors} per paper)
          </span>
        </h3>
        <CoAuthorNetworkGraph links={stats.coAuthorLinks} uniqueAuthors={stats.uniqueAuthors} />
      </div>

      {/* Co-Author Collaborations List */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Top Collaborations
        </h3>
        {stats.coAuthorLinks.length > 0 ? (
          <div className="space-y-2">
            {stats.coAuthorLinks.slice(0, showAllCoAuthors ? 20 : 8).map((link: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="truncate">{link.source}</span>
                <span className="text-muted-foreground">↔</span>
                <span className="truncate">{link.target}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{link.weight} paper{link.weight > 1 ? 's' : ''}</Badge>
              </div>
            ))}
            {stats.coAuthorLinks.length > 8 && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllCoAuthors(!showAllCoAuthors)}>
                {showAllCoAuthors ? <>Show Less <ChevronUp className="w-3 h-3 ml-1" /></> : <>Show {Math.min(stats.coAuthorLinks.length - 8, 12)} More <ChevronDown className="w-3 h-3 ml-1" /></>}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No co-author data available</p>
        )}
      </div>

      {/* Three Column Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-secondary/30 rounded-lg p-4">
          <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-muted-foreground" />
            Grants
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Coverage</span>
              <span className="text-sm font-medium">{stats.grantCoverage}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Unique grants</span>
              <span className="text-sm font-medium">{stats.uniqueGrants}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2 space-y-1">
              {stats.grantsList.slice(0, 3).map(([grant, count]: [string, number]) => (
                <div key={grant} className="flex justify-between items-center text-xs">
                  <span className="truncate text-muted-foreground">{grant}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-4">
          <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            Working Papers
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-sm font-medium">{stats.workingPaperCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">% of publications</span>
              <span className="text-sm font-medium">{stats.workingPaperPercent}%</span>
            </div>
          </div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-4">
          <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Target Years
          </h3>
          <div className="space-y-1">
            {Object.entries(stats.yearCounts)
              .sort((a, b) => (a[0] === 'Not set' ? 1 : b[0] === 'Not set' ? -1 : b[0].localeCompare(a[0])))
              .slice(0, 4)
              .map(([year, count]) => (
                <div key={year} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{year}</span>
                  <span className="text-sm font-medium">{count as number}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Target Journals */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-muted-foreground" />
          Target Journals
          <span className="text-xs text-muted-foreground ml-2">({stats.journalsList.length} journals)</span>
        </h3>
        {stats.journalsList.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {stats.journalsList.slice(0, showAllJournals ? 50 : 10).map(([journal, count]: [string, number]) => (
              <Badge key={journal} variant="outline" className="text-xs px-2 py-1">
                {journal} <span className="ml-1 text-accent font-bold">{count}</span>
              </Badge>
            ))}
            {stats.journalsList.length > 10 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowAllJournals(!showAllJournals)}>
                {showAllJournals ? 'Show Less' : `+${stats.journalsList.length - 10} more`}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No target journals specified yet</p>
        )}
      </div>

      {/* Output Types */}
      <div className="bg-secondary/30 rounded-lg p-4">
        <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          Output Types
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.outputCounts).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5">
              <span className="text-sm capitalize">{type.replace(/-/g, ' ')}</span>
              <span className="text-sm font-medium text-accent">{count as number}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
