import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeams } from '@/hooks/useTeams';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, Filter, X, Users, TrendingUp, LayoutGrid, Eye, Printer, FileSpreadsheet } from 'lucide-react';
import { STAGE_LABELS, STAGE_ORDER } from '@/types/team';
import type { PipelineStage, TeamMember } from '@/types/team';
import { STAGE_COLORS } from '@/types/publication';
import { TeamAnalyticsView } from '@/components/TeamAnalyticsView';
import { exportTeamPipelineToExcel } from '@/lib/pipelineExport';
import { Navigate } from 'react-router-dom';

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

const VISIBLE_STAGES = STAGE_ORDER.filter(s => s !== 'idea');

export default function TeamWorkspace() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { teams, loading: teamsLoading, getTeamMembers } = useTeams(user?.id);

  const [publications, setPublications] = useState<TeamPublication[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [themeFilter, setThemeFilter] = useState('__all__');
  const [grantFilter, setGrantFilter] = useState('__all__');
  const [yearFilter, setYearFilter] = useState('__all__');
  const [memberFilter, setMemberFilter] = useState('__all__');

  // Member Pipelines tab
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberPubs, setMemberPubs] = useState<TeamPublication[]>([]);
  const [memberPubsLoading, setMemberPubsLoading] = useState(false);

  const team = useMemo(() => teams.find(t => t.id === teamId), [teams, teamId]);

  const isAdmin = useMemo(() => {
    if (!team || !user) return false;
    if (team.createdBy === user.id) return true;
    const me = members.find(m => m.userId === user.id);
    return me?.role === 'admin';
  }, [team, user, members]);

  // Fetch all team publications and members
  useEffect(() => {
    if (!teamId || !user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pubResult, fetchedMembers] = await Promise.all([
          supabase.rpc('get_team_all_publications', { _team_id: teamId }),
          getTeamMembers(teamId),
        ]);

        if (pubResult.error) {
          setError('Unable to load team publications.');
          return;
        }

        const pubs = ((pubResult.data as any[]) || []).map((p: any) => ({
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
        setMembers(fetchedMembers);
      } catch (err) {
        console.error('Error:', err);
        setError('An error occurred while loading data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, user, getTeamMembers]);

  // Visible publications (no ideas)
  const visiblePublications = useMemo(
    () => publications.filter(p => p.stage !== 'idea'),
    [publications]
  );

  // Filter options
  const filterOptions = useMemo(() => {
    const themes = new Set<string>();
    const grants = new Set<string>();
    const years = new Set<string>();
    const owners = new Map<string, string>();

    visiblePublications.forEach(pub => {
      pub.themes.forEach(t => themes.add(t));
      pub.grants.forEach(g => grants.add(g));
      if (pub.targetYear) years.add(pub.targetYear.toString());
      if (!owners.has(pub.ownerId)) owners.set(pub.ownerId, pub.ownerName);
    });

    return {
      themes: Array.from(themes).sort(),
      grants: Array.from(grants).sort(),
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      members: Array.from(owners.entries()).map(([id, name]) => ({ id, name })),
    };
  }, [visiblePublications]);

  // Apply filters
  const filteredPublications = useMemo(() => {
    return visiblePublications.filter(pub => {
      if (themeFilter !== '__all__' && !pub.themes.includes(themeFilter)) return false;
      if (grantFilter !== '__all__' && !pub.grants.includes(grantFilter)) return false;
      if (yearFilter !== '__all__' && pub.targetYear?.toString() !== yearFilter) return false;
      if (memberFilter !== '__all__' && pub.ownerId !== memberFilter) return false;
      return true;
    });
  }, [visiblePublications, themeFilter, grantFilter, yearFilter, memberFilter]);

  // Group by stage for pipeline view
  const pubsByStage = useMemo(() => {
    const grouped: Record<string, TeamPublication[]> = {};
    VISIBLE_STAGES.forEach(stage => {
      grouped[stage] = filteredPublications.filter(p => p.stage === stage);
    });
    return grouped;
  }, [filteredPublications]);

  const hasActiveFilters = themeFilter !== '__all__' || grantFilter !== '__all__' || yearFilter !== '__all__' || memberFilter !== '__all__';

  const clearFilters = () => {
    setThemeFilter('__all__');
    setGrantFilter('__all__');
    setYearFilter('__all__');
    setMemberFilter('__all__');
  };

  // Load member-specific publications
  const handleSelectMember = useCallback(async (memberId: string) => {
    setSelectedMemberId(memberId);
    if (!teamId || !user) return;
    setMemberPubsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_team_member_publications', {
        _member_id: memberId,
        _team_id: teamId,
        _viewer_id: user.id,
      });
      if (error) throw error;
      const pubs = ((data as any[]) || []).map((p: any) => ({
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
      setMemberPubs(pubs);
    } catch (err) {
      console.error('Error loading member publications:', err);
    } finally {
      setMemberPubsLoading(false);
    }
  }, [teamId, user]);

  // Member pipeline grouped by stage
  const memberPubsByStage = useMemo(() => {
    const visible = memberPubs.filter(p => p.stage !== 'idea');
    const grouped: Record<string, TeamPublication[]> = {};
    VISIBLE_STAGES.forEach(stage => {
      grouped[stage] = visible.filter(p => p.stage === stage);
    });
    return grouped;
  }, [memberPubs]);

  const acceptedMembers = useMemo(
    () => members.filter(m => m.status === 'accepted' && m.userId && m.userId !== user?.id),
    [members, user]
  );

  if (authLoading || teamsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  if (!teamsLoading && !team) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Team not found or you don't have access.</p>
        <Button variant="outline" onClick={() => navigate('/')}>← Back to Pipeline</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          My Pipeline
        </Button>
        <div className="h-6 w-px bg-border" />
        {team?.logoUrl && (
          <Avatar className="w-8 h-8">
            <AvatarImage src={team.logoUrl} />
            <AvatarFallback>{team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
        <div>
          <h1 className="font-display font-semibold text-lg">{team?.name}</h1>
          {team?.description && (
            <p className="text-xs text-muted-foreground">{team.description}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-4 h-4" />
          {members.filter(m => m.status === 'accepted').length} members
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 py-4 max-w-[1440px] w-full mx-auto">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-destructive">{error}</div>
        ) : (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col">
            <TabsList className="w-fit mb-4">
              <TabsTrigger value="overview" className="gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                <Eye className="w-4 h-4" />
                Member Pipelines
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="analytics" className="gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Analytics
                </TabsTrigger>
              )}
            </TabsList>

            {/* === OVERVIEW TAB === */}
            <TabsContent value="overview" className="flex-1 flex flex-col min-h-0">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="w-[150px] h-8 text-sm">
                    <SelectValue placeholder="Member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Members</SelectItem>
                    {filterOptions.members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="outline" className="h-8 px-3">
                    {filteredPublications.length} publication{filteredPublications.length !== 1 ? 's' : ''}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => exportTeamPipelineToExcel({
                      publications: filteredPublications,
                      teamName: team?.name || 'team',
                    })}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      document.body.classList.add('printing-team-pipeline');
                      setTimeout(() => {
                        window.print();
                        setTimeout(() => document.body.classList.remove('printing-team-pipeline'), 100);
                      }, 100);
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    PDF
                  </Button>
                </div>
              </div>

              {/* Pipeline columns */}
              <div className="flex-1 flex gap-2 overflow-x-auto overflow-y-hidden pb-2 min-h-0">
                {VISIBLE_STAGES.map((stageId) => {
                  const pubs = pubsByStage[stageId] || [];
                  const colorIndex = STAGE_ORDER.indexOf(stageId);
                  const stageColor = STAGE_COLORS[colorIndex] || 'stage-2';
                  const totalForStage = visiblePublications.filter(p => p.stage === stageId).length;
                  const funnelRatio = 1 - (colorIndex / 7) * 0.4;

                  return (
                    <section
                      key={stageId}
                      className="bg-card border border-border rounded-xl shadow-card flex flex-col overflow-hidden h-full"
                      style={{ flex: `${funnelRatio} 1 0`, minWidth: '160px' }}
                    >
                      <header className="p-3 flex items-center justify-between gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: `hsl(var(--${stageColor}))`,
                              boxShadow: `0 0 0 3px hsl(var(--${stageColor}) / 0.2)`,
                            }}
                          />
                          <h2 className="font-display font-semibold text-sm truncate">
                            {STAGE_LABELS[stageId as PipelineStage]}
                          </h2>
                        </div>
                        <span className="text-muted-foreground text-xs flex-shrink-0">
                          {hasActiveFilters ? `${pubs.length}/${totalForStage}` : totalForStage}
                        </span>
                      </header>

                      <ScrollArea className="flex-1">
                        <div className="px-2 pb-2">
                          {pubs.length === 0 ? (
                            <div className="text-muted-foreground/40 text-xs text-center py-6">
                              No publications
                            </div>
                          ) : (
                            pubs.map(pub => (
                              <TeamPubCard key={pub.id} pub={pub} stageColor={stageColor} />
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </section>
                  );
                })}
              </div>
            </TabsContent>

            {/* === MEMBER PIPELINES TAB === */}
            <TabsContent value="members" className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium">View pipeline for:</span>
                <Select
                  value={selectedMemberId || ''}
                  onValueChange={(v) => v && handleSelectMember(v)}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select a team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {acceptedMembers.map(m => (
                      <SelectItem key={m.userId} value={m.userId!}>
                        {m.displayName || m.email || 'Unknown'}
                        {m.universityAffiliation ? ` · ${m.universityAffiliation}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedMemberId ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>Select a team member to view their pipeline</p>
                  </div>
                </div>
              ) : memberPubsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Member info bar */}
                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                    <span>
                      {memberPubs.filter(p => p.stage !== 'idea').length} visible publications
                    </span>
                  </div>

                  {/* Pipeline columns */}
                  <div className="flex-1 flex gap-2 overflow-x-auto overflow-y-hidden pb-2 min-h-0">
                    {VISIBLE_STAGES.map((stageId) => {
                      const pubs = memberPubsByStage[stageId] || [];
                      const colorIndex = STAGE_ORDER.indexOf(stageId);
                      const stageColor = STAGE_COLORS[colorIndex] || 'stage-2';
                      const funnelRatio = 1 - (colorIndex / 7) * 0.4;

                      return (
                        <section
                          key={stageId}
                          className="bg-card border border-border rounded-xl shadow-card flex flex-col overflow-hidden h-full"
                          style={{ flex: `${funnelRatio} 1 0`, minWidth: '160px' }}
                        >
                          <header className="p-3 flex items-center justify-between gap-2 flex-shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: `hsl(var(--${stageColor}))`,
                                  boxShadow: `0 0 0 3px hsl(var(--${stageColor}) / 0.2)`,
                                }}
                              />
                              <h2 className="font-display font-semibold text-sm truncate">
                                {STAGE_LABELS[stageId as PipelineStage]}
                              </h2>
                            </div>
                            <span className="text-muted-foreground text-xs">{pubs.length}</span>
                          </header>

                          <ScrollArea className="flex-1">
                            <div className="px-2 pb-2">
                              {pubs.length === 0 ? (
                                <div className="text-muted-foreground/40 text-xs text-center py-6">
                                  —
                                </div>
                              ) : (
                                pubs.map(pub => (
                                  <TeamPubCard key={pub.id} pub={pub} stageColor={stageColor} />
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === ANALYTICS TAB === */}
            {isAdmin && (
              <TabsContent value="analytics" className="flex-1 min-h-0 overflow-auto">
                <TeamAnalyticsView
                  open={true}
                  onOpenChange={() => {}}
                  publications={publications}
                  teamName={team?.name || ''}
                  embedded
                />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}

/** Read-only publication card for team views */
function TeamPubCard({ pub, stageColor }: { pub: TeamPublication; stageColor: string }) {
  return (
    <article className="p-3 mb-2 rounded-lg border border-border bg-card hover:bg-accent/10 transition-colors cursor-default">
      <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2 mb-1.5">
        {pub.title || 'Untitled'}
      </h3>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-medium text-muted-foreground">
          {pub.ownerAvatar ? (
            <img src={pub.ownerAvatar} className="w-3.5 h-3.5 rounded-full" alt="" />
          ) : null}
          {pub.ownerName}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {pub.authors.slice(0, 2).map((a, i) => (
          <span key={i} className="chip text-[10px]">{a}</span>
        ))}
        {pub.authors.length > 2 && (
          <span className="chip text-[10px]">+{pub.authors.length - 2}</span>
        )}
        {pub.themes.slice(0, 1).map((t, i) => (
          <span key={i} className="chip-accent chip text-[10px]">{t}</span>
        ))}
        {pub.targetYear && (
          <span className="chip text-[10px] font-medium">{pub.targetYear}</span>
        )}
        {pub.workingPaper?.isWorkingPaper && (
          <span className="chip-wp chip text-[10px] font-semibold">WP</span>
        )}
      </div>
    </article>
  );
}
