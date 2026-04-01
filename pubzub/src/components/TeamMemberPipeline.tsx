import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Printer, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { STAGE_LABELS, STAGE_ORDER } from '@/types/team';
import type { PipelineStage } from '@/types/team';
import { STAGE_COLORS } from '@/types/publication';

interface TeamMemberPipelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  teamId: string;
  viewerId?: string;
}

interface MemberProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  universityAffiliation?: string;
}

interface MemberPublication {
  id: string;
  title: string;
  stageId: string;
  authors: string[];
  themes: string[];
  grants: string[];
  targetYear?: number;
  outputType?: string;
  updatedAt: string;
}

export function TeamMemberPipeline({ open, onOpenChange, memberId, teamId, viewerId }: TeamMemberPipelineProps) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [publications, setPublications] = useState<MemberPublication[]>([]);
  const [minVisibleStage, setMinVisibleStage] = useState<PipelineStage>('idea');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !memberId || !teamId || !viewerId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch member profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, university_affiliation')
          .eq('id', memberId)
          .single();

        if (profileError) {
          console.error('Profile error:', profileError);
          // Profile might not be visible, but we can still try to get publications
        }

        if (profileData) {
          setProfile({
            id: profileData.id,
            displayName: profileData.display_name || 'Unknown',
            avatarUrl: profileData.avatar_url || undefined,
            universityAffiliation: profileData.university_affiliation || undefined,
          });
        }

        // Use the secure RPC function to get member's publications
        const { data: pubData, error: pubError } = await supabase
          .rpc('get_team_member_publications', {
            _viewer_id: viewerId,
            _member_id: memberId,
            _team_id: teamId,
          });

        if (pubError) {
          console.error('Publications error:', pubError);
          setError('Unable to load publications. You may not have access.');
          return;
        }

        if (!pubData) {
          setError('No access to this member\'s publications.');
          return;
        }

        const result = pubData as { publications: any[]; minVisibleStage: string };
        setMinVisibleStage((result.minVisibleStage as PipelineStage) || 'idea');
        
        setPublications(result.publications?.map((p: any) => ({
          id: p.id,
          title: p.title,
          stageId: p.stage,
          authors: p.authors || [],
          themes: p.themes || [],
          grants: p.grants || [],
          targetYear: p.targetYear,
          outputType: p.outputType,
          updatedAt: p.updatedAt,
        })) || []);
      } catch (error) {
        console.error('Error fetching member data:', error);
        setError('An error occurred while loading data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, memberId, teamId, viewerId]);

  // Group by stage
  const publicationsByStage = useMemo(() => {
    const grouped: Record<string, MemberPublication[]> = {};
    STAGE_ORDER.forEach(stage => {
      grouped[stage] = publications.filter(p => p.stageId === stage);
    });
    return grouped;
  }, [publications]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStageColor = (stageId: string): string => {
    const index = STAGE_ORDER.indexOf(stageId as PipelineStage);
    return STAGE_COLORS[index] || 'stage-1';
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const stageColors = ['#8b5cf6', '#3b82f6', '#06b6d4', '#f59e0b', '#f97316', '#22c55e', '#10b981'];
    
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${profile?.displayName || 'Team Member'}'s Pipeline</title>
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
            margin-bottom: 30px;
          }
          .header h1 { font-size: 24px; margin-bottom: 4px; }
          .header .subtitle { color: #666; font-size: 14px; }
          .header .date { text-align: right; color: #666; font-size: 14px; }
          .stage { margin-bottom: 24px; }
          .stage-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
          }
          .stage-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }
          .stage-name { font-weight: 600; font-size: 14px; }
          .badge { 
            background: #f3f4f6;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
          }
          .publication {
            margin-left: 20px;
            padding: 12px;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            margin-bottom: 8px;
          }
          .pub-title { font-weight: 500; margin-bottom: 4px; }
          .pub-authors { font-size: 13px; color: #666; }
          .pub-tags { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
          .tag {
            background: #f3f4f6;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            color: #666;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${profile?.displayName || 'Team Member'}'s Pipeline</h1>
            <div class="subtitle">${profile?.universityAffiliation || ''}</div>
          </div>
          <div class="date">
            <div>Generated on</div>
            <div style="font-weight: 600;">${new Date().toLocaleDateString()}</div>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <strong>Total Publications:</strong> ${publications.length}
          ${minVisibleStage !== 'idea' ? `<span style="color: #666;"> (showing from ${STAGE_LABELS[minVisibleStage]} onwards)</span>` : ''}
        </div>

        ${STAGE_ORDER.map((stage, idx) => {
          const pubs = publicationsByStage[stage] || [];
          if (pubs.length === 0) return '';
          return `
            <div class="stage">
              <div class="stage-header">
                <div class="stage-dot" style="background: ${stageColors[idx]};"></div>
                <span class="stage-name">${STAGE_LABELS[stage]}</span>
                <span class="badge">${pubs.length}</span>
              </div>
              ${pubs.map(pub => `
                <div class="publication">
                  <div class="pub-title">${pub.title}</div>
                  ${pub.authors.length > 0 ? `<div class="pub-authors">${pub.authors.join(', ')}</div>` : ''}
                  ${pub.themes.length > 0 || pub.grants.length > 0 ? `
                    <div class="pub-tags">
                      ${pub.themes.map(t => `<span class="tag">${t}</span>`).join('')}
                      ${pub.grants.map(g => `<span class="tag" style="background: #fef3c7;">${g}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #999; font-size: 11px; text-align: center;">
          Generated by PubZub · ${new Date().toLocaleDateString()}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {profile && (
              <>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={profile.avatarUrl} />
                  <AvatarFallback>{getInitials(profile.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <DialogTitle>{profile.displayName}'s Pipeline</DialogTitle>
                  {profile.universityAffiliation && (
                    <p className="text-sm text-muted-foreground">{profile.universityAffiliation}</p>
                  )}
                </div>
              </>
            )}
            {!loading && publications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-2"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </Button>
            )}
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
          <ScrollArea className="flex-1">
            <div ref={contentRef} className="space-y-6 pr-4">
              {minVisibleStage !== 'idea' && (
                <p className="text-sm text-muted-foreground italic">
                  Showing publications from "{STAGE_LABELS[minVisibleStage]}" stage onwards
                </p>
              )}

              {publications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No visible publications</p>
                  <p className="text-sm mt-1">
                    This researcher hasn't shared any publications at the visible stages yet.
                  </p>
                </div>
              ) : (
                STAGE_ORDER.map((stageId, stageIndex) => {
                  const pubs = publicationsByStage[stageId] || [];
                  if (pubs.length === 0) return null;
                  const stageColor = STAGE_COLORS[stageIndex] || 'stage-1';
                  
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
                      <div className="grid gap-2 ml-5">
                        {pubs.map((pub) => (
                          <div
                            key={pub.id}
                            className="p-3 rounded-lg border bg-card"
                          >
                            <h4 className="font-medium line-clamp-2">{pub.title}</h4>
                            {pub.authors.length > 0 && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {pub.authors.join(', ')}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {pub.themes.slice(0, 3).map((theme, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {theme}
                                </Badge>
                              ))}
                              {pub.grants.slice(0, 2).map((grant, i) => (
                                <Badge key={`g-${i}`} variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                  {grant}
                                </Badge>
                              ))}
                              {pub.targetYear && (
                                <Badge variant="outline" className="text-xs">
                                  Target: {pub.targetYear}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
