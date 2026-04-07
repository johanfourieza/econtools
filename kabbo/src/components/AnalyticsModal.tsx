import { X, TrendingUp, Clock, Users, FileText, Award, Percent, Calendar, Target, BookOpen, Link2, GitBranch, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Publication, Stage, DEFAULT_STAGES } from '@/types/publication';
import { useMemo } from 'react';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Publication[];
  stages: Stage[];
  publishedCards: Publication[];
}

export function AnalyticsModal({ isOpen, onClose, cards, stages, publishedCards }: AnalyticsModalProps) {
  const stats = useMemo(() => {
    const allCards = [...cards, ...publishedCards];
    const allStages = stages.length > 0 ? stages : DEFAULT_STAGES;
    
    // Stage distribution
    const stageDistribution = allStages.map(stage => ({
      stage,
      count: allCards.filter(c => c.stageId === stage.id).length,
    }));

    // Funnel conversions
    const ideaCount = allCards.filter(c => c.stageId === 'idea').length;
    const draftCount = allCards.filter(c => c.stageId === 'draft').length;
    const submittedCount = allCards.filter(c => c.stageId === 'submitted').length;
    const publishedCount = publishedCards.length;
    
    const ideasToDraft = ideaCount > 0 ? Math.round((draftCount / ideaCount) * 100) : 0;
    const draftToSubmitted = draftCount > 0 ? Math.round((submittedCount / draftCount) * 100) : 0;
    const submittedToPublished = submittedCount > 0 ? Math.round((publishedCount / submittedCount) * 100) : 0;
    const overallConversion = ideaCount > 0 ? Math.round((publishedCount / ideaCount) * 100) : 0;

    // Time metrics (based on history entries)
    const avgTimeInPipeline = (() => {
      const completedCards = publishedCards.filter(c => c.history && c.history.length > 0);
      if (completedCards.length === 0) return null;
      
      const durations = completedCards.map(card => {
        const created = new Date(card.createdAt).getTime();
        const lastMove = card.history.length > 0 
          ? new Date(card.history[card.history.length - 1].at).getTime()
          : new Date(card.updatedAt).getTime();
        return (lastMove - created) / (1000 * 60 * 60 * 24); // days
      });
      return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    })();

    // Working paper stats
    const workingPaperCount = allCards.filter(c => c.workingPaper?.on).length;
    const workingPaperPercent = allCards.length > 0 
      ? Math.round((workingPaperCount / allCards.length) * 100) 
      : 0;

    // Collaboration links stats
    const withCollaborationLinks = allCards.filter(c => 
      (c.collaborationLinks && c.collaborationLinks.length > 0) || c.githubRepo || c.overleafLink
    ).length;
    const collaborationLinksPercent = allCards.length > 0 
      ? Math.round((withCollaborationLinks / allCards.length) * 100) 
      : 0;

    // Collaboration stats
    const allAuthors = allCards.flatMap(c => 
      c.authors?.split(',').map(a => a.trim()).filter(Boolean) || []
    );
    const uniqueCoauthors = [...new Set(allAuthors)];
    const avgCoauthors = allCards.length > 0 
      ? (allCards.reduce((sum, c) => {
          const authors = c.authors?.split(',').map(a => a.trim()).filter(Boolean) || [];
          return sum + authors.length;
        }, 0) / allCards.length).toFixed(1)
      : '0';

    // Theme distribution
    const allThemes = allCards.flatMap(c => 
      c.themes?.split(',').map(t => t.trim()).filter(Boolean) || []
    );
    const themeCount: Record<string, number> = {};
    allThemes.forEach(t => { themeCount[t] = (themeCount[t] || 0) + 1; });
    const topThemes = Object.entries(themeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Output type distribution
    const journalCount = allCards.filter(c => c.outputType === 'journal').length;
    const bookCount = allCards.filter(c => c.outputType === 'book').length;
    const chapterCount = allCards.filter(c => c.outputType === 'chapter').length;

    // Year distribution for published
    const publishedByYear: Record<string, number> = {};
    publishedCards.forEach(c => {
      const year = c.publishedYear?.toString() || 'Unknown';
      publishedByYear[year] = (publishedByYear[year] || 0) + 1;
    });

    // Target year distribution (for pipeline items)
    const targetYearDistribution: Record<string, number> = {};
    cards.forEach(c => {
      const year = c.completionYear || 'Not set';
      targetYearDistribution[year] = (targetYearDistribution[year] || 0) + 1;
    });

    // Grant coverage
    const withGrants = allCards.filter(c => c.grants && c.grants.trim().length > 0).length;
    const grantsCoverage = allCards.length > 0 
      ? Math.round((withGrants / allCards.length) * 100) 
      : 0;
    
    // All unique grants
    const allGrants = allCards.flatMap(c => 
      c.grants?.split(',').map(g => g.trim()).filter(Boolean) || []
    );
    const uniqueGrants = [...new Set(allGrants)];

    // Links & Resources coverage
    const withLinks = allCards.filter(c => c.links && c.links.length > 0).length;
    const linksCoverage = allCards.length > 0 
      ? Math.round((withLinks / allCards.length) * 100) 
      : 0;
    const totalLinks = allCards.reduce((sum, c) => sum + (c.links?.length || 0), 0);

    // GitHub/Overleaf coverage
    const withGithub = allCards.filter(c => c.githubRepo && c.githubRepo.trim().length > 0).length;
    const withOverleaf = allCards.filter(c => c.overleafLink && c.overleafLink.trim().length > 0).length;


    // Reminders
    const totalReminders = allCards.reduce((sum, c) => sum + (c.reminders?.length || 0), 0);
    const pendingReminders = allCards.reduce((sum, c) => 
      sum + (c.reminders?.filter(r => !r.isCompleted).length || 0), 0);

    // Activity metrics - recent updates
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentlyUpdated = allCards.filter(c => new Date(c.updatedAt) >= thirtyDaysAgo).length;
    const recentlyCreated = allCards.filter(c => new Date(c.createdAt) >= thirtyDaysAgo).length;

    // Notes coverage
    const withNotes = allCards.filter(c => c.notes && c.notes.trim().length > 0).length;
    const notesCoverage = allCards.length > 0 
      ? Math.round((withNotes / allCards.length) * 100) 
      : 0;

    // Completeness score (average of various fields filled)
    const completenessScore = allCards.length > 0 ? Math.round(
      allCards.reduce((sum, c) => {
        let score = 0;
        if (c.title && c.title.trim()) score += 1;
        if (c.authors && c.authors.trim()) score += 1;
        if (c.themes && c.themes.trim()) score += 1;
        if (c.grants && c.grants.trim()) score += 1;
        if (c.outputType) score += 1;
        if (c.notes && c.notes.trim()) score += 1;
        if (c.links && c.links.length > 0) score += 1;
        if ((c.collaborationLinks && c.collaborationLinks.length > 0) || c.githubRepo || c.overleafLink) score += 1;
        return sum + (score / 8 * 100);
      }, 0) / allCards.length
    ) : 0;

    return {
      total: allCards.length,
      inPipeline: cards.length,
      published: publishedCount,
      stageDistribution,
      ideasToDraft,
      draftToSubmitted,
      submittedToPublished,
      overallConversion,
      avgTimeInPipeline,
      workingPaperCount,
      workingPaperPercent,
      withCollaborationLinks,
      collaborationLinksPercent,
      uniqueCoauthors: uniqueCoauthors.length,
      avgCoauthors,
      topThemes,
      journalCount,
      bookCount,
      chapterCount,
      publishedByYear,
      // New metrics
      targetYearDistribution,
      withGrants,
      grantsCoverage,
      uniqueGrants: uniqueGrants.length,
      withLinks,
      linksCoverage,
      totalLinks,
      withGithub,
      withOverleaf,
      totalReminders,
      pendingReminders,
      recentlyUpdated,
      recentlyCreated,
      withNotes,
      notesCoverage,
      completenessScore,
    };
  }, [cards, stages, publishedCards]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-foreground/20 z-40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[700px] md:max-h-[85vh] bg-card border border-border rounded-xl shadow-lg z-50 flex flex-col animate-scale-in overflow-hidden">
        <header className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <h2 className="font-display font-semibold text-lg">Publication Analytics</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-display font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Publications</div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-display font-bold text-accent">{stats.inPipeline}</div>
              <div className="text-xs text-muted-foreground mt-1">In Pipeline</div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-display font-bold text-foreground">{stats.published}</div>
              <div className="text-xs text-muted-foreground mt-1">Published</div>
            </div>
          </div>

          {/* Visual Funnel Diagram */}
          <div className="bg-secondary/30 rounded-lg p-4">
            <h3 className="font-display font-medium text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Publication Funnel
            </h3>
            <div className="flex flex-col items-center gap-1">
              {(() => {
                // Calculate max count across all stages including published for proportional sizing
                const allCounts = [...stats.stageDistribution.map(s => s.count), stats.published];
                const maxCount = Math.max(...allCounts, 1); // Avoid division by zero
                
                return (
                  <>
                    {stats.stageDistribution.map((item, i) => {
                      // Width proportional to count, with minimum of 20% for visibility
                      const widthPercent = Math.max(20, (item.count / maxCount) * 100);
                      const count = item.count;
                      return (
                        <div 
                          key={item.stage.id}
                          className="relative flex items-center justify-center transition-all duration-500"
                          style={{ 
                            width: `${widthPercent}%`,
                            height: '32px',
                            background: `linear-gradient(90deg, hsl(var(--stage-${i + 1}) / 0.15), hsl(var(--stage-${i + 1}) / 0.25), hsl(var(--stage-${i + 1}) / 0.15))`,
                            borderLeft: `3px solid hsl(var(--stage-${i + 1}))`,
                            borderRight: `3px solid hsl(var(--stage-${i + 1}))`,
                          }}
                        >
                          <span className="text-xs font-medium">{item.stage.name}</span>
                          <span className="absolute right-3 text-xs text-muted-foreground">{count}</span>
                        </div>
                      );
                    })}
                    {/* Published at bottom */}
                    <div 
                      className="relative flex items-center justify-center mt-2 rounded-md"
                      style={{ 
                        width: `${Math.max(20, (stats.published / maxCount) * 100)}%`,
                        height: '36px',
                        background: `linear-gradient(90deg, hsl(var(--accent) / 0.2), hsl(var(--accent) / 0.35), hsl(var(--accent) / 0.2))`,
                        border: `2px solid hsl(var(--accent))`,
                      }}
                    >
                      <span className="text-xs font-semibold text-accent">Published</span>
                      <span className="absolute right-3 text-xs font-medium">{stats.published}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-3">
              Bar widths reflect actual publication counts
            </p>
          </div>

          {/* Funnel Conversion Rates */}
          <div className="bg-secondary/30 rounded-lg p-4">
            <h3 className="font-display font-medium text-sm mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              Conversion Rates
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs w-24">Idea → Draft</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-soft-amber to-warm-coral transition-all duration-500"
                    style={{ width: `${stats.ideasToDraft}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-12 text-right">{stats.ideasToDraft}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-24">Draft → Submitted</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-warm-coral to-nordic-blue transition-all duration-500"
                    style={{ width: `${stats.draftToSubmitted}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-12 text-right">{stats.draftToSubmitted}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-24">→ Published</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-nordic-blue to-sage transition-all duration-500"
                    style={{ width: `${stats.submittedToPublished}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-12 text-right">{stats.submittedToPublished}%</span>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Overall: Idea → Published</span>
                  <span className="text-sm font-display font-bold text-accent">{stats.overallConversion}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Stats */}
          <div className="grid grid-cols-2 gap-4">
            {/* Time & Pipeline */}
            <div className="bg-secondary/30 rounded-lg p-4">
              <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Pipeline Metrics
              </h3>
              <div className="space-y-2">
                {stats.avgTimeInPipeline !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Avg. time to publish</span>
                    <span className="text-sm font-medium">{stats.avgTimeInPipeline} days</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Working papers</span>
                  <span className="text-sm font-medium">{stats.workingPaperCount} ({stats.workingPaperPercent}%)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">With collaboration links</span>
                  <span className="text-sm font-medium">{stats.withCollaborationLinks} ({stats.collaborationLinksPercent}%)</span>
                </div>
              </div>
            </div>

            {/* Collaboration */}
            <div className="bg-secondary/30 rounded-lg p-4">
              <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Collaboration
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Unique co-authors</span>
                  <span className="text-sm font-medium">{stats.uniqueCoauthors}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Avg. authors/paper</span>
                  <span className="text-sm font-medium">{stats.avgCoauthors}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Output Types */}
          <div className="bg-secondary/30 rounded-lg p-4">
            <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Output Types
            </h3>
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <div className="text-2xl font-display font-bold">{stats.journalCount}</div>
                <div className="text-xs text-muted-foreground">Journal Articles</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-display font-bold">{stats.bookCount}</div>
                <div className="text-xs text-muted-foreground">Books</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-display font-bold">{stats.chapterCount}</div>
                <div className="text-xs text-muted-foreground">Chapters</div>
              </div>
            </div>
          </div>

          {/* Top Themes */}
          {stats.topThemes.length > 0 && (
            <div className="bg-secondary/30 rounded-lg p-4">
              <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-muted-foreground" />
                Top Research Themes
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.topThemes.map(([theme, count]) => (
                  <div 
                    key={theme} 
                    className="px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-xs"
                  >
                    {theme} <span className="text-muted-foreground">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage Distribution */}
          <div className="bg-secondary/30 rounded-lg p-4">
            <h3 className="font-display font-medium text-sm mb-3">Current Stage Distribution</h3>
            <div className="flex items-end gap-1 h-20">
              {stats.stageDistribution.map((item, i) => {
                const maxCount = Math.max(...stats.stageDistribution.map(s => s.count), 1);
                const height = (item.count / maxCount) * 100;
                return (
                  <div key={item.stage.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-medium">{item.count}</span>
                    <div 
                      className="w-full rounded-t transition-all duration-500"
                      style={{ 
                        height: `${Math.max(height, 4)}%`,
                        background: `hsl(var(--stage-${i + 1}))`,
                      }}
                    />
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                      {item.stage.name.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Completeness Score */}
          <div className="bg-secondary/30 rounded-lg p-4">
            <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              Data Completeness
            </h3>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-secondary"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${stats.completenessScore * 2.01} 201`}
                    className="text-accent"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-display font-bold">
                  {stats.completenessScore}%
                </span>
              </div>
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With notes</span>
                  <span className="font-medium">{stats.notesCoverage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With grants</span>
                  <span className="font-medium">{stats.grantsCoverage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With links</span>
                  <span className="font-medium">{stats.linksCoverage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With collaboration links</span>
                  <span className="font-medium">{stats.collaborationLinksPercent}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-secondary/30 rounded-lg p-4">
            <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Recent Activity (30 days)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-display font-bold text-accent">{stats.recentlyCreated}</div>
                <div className="text-xs text-muted-foreground">New publications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display font-bold">{stats.recentlyUpdated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
            </div>
          </div>

          {/* Resources & Connections */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-lg p-4">
              <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Resources
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total links</span>
                  <span className="font-medium">{stats.totalLinks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GitHub repos</span>
                  <span className="font-medium">{stats.withGithub}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unique grants</span>
                  <span className="font-medium">{stats.uniqueGrants}</span>
                </div>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-4">
              <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-muted-foreground" />
                Integrations
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GitHub repos</span>
                  <span className="font-medium">{stats.withGithub}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overleaf projects</span>
                  <span className="font-medium">{stats.withOverleaf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Working papers</span>
                  <span className="font-medium">{stats.workingPaperCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reminders Summary */}
          {stats.totalReminders > 0 && (
            <div className="bg-secondary/30 rounded-lg p-4">
              <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                Reminders
              </h3>
              <div className="flex gap-4">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-display font-bold">{stats.totalReminders}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-display font-bold text-accent">{stats.pendingReminders}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-display font-bold text-muted-foreground">{stats.totalReminders - stats.pendingReminders}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
              </div>
            </div>
          )}

          {/* Published by Year */}
          {Object.keys(stats.publishedByYear).length > 0 && (
            <div className="bg-secondary/30 rounded-lg p-4">
              <h3 className="font-display font-medium text-sm mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                Publications by Year
              </h3>
              <div className="flex items-end gap-2 h-16">
                {Object.entries(stats.publishedByYear)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([year, count]) => {
                    const maxCount = Math.max(...Object.values(stats.publishedByYear), 1);
                    const height = (count / maxCount) * 100;
                    return (
                      <div key={year} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-medium">{count}</span>
                        <div 
                          className="w-full rounded-t bg-accent transition-all duration-500"
                          style={{ height: `${Math.max(height, 8)}%` }}
                        />
                        <span className="text-[9px] text-muted-foreground">{year}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}