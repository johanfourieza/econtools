import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Github, Server, Terminal, FileCode, RefreshCw, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEntry {
  id: string;
  source: string;
  action: string;
  publication_id: string | null;
  publication_title: string | null;
  details: Record<string, unknown> | null;
  kabbo_yaml_detected: boolean;
  created_at: string;
}

const sourceIcons: Record<string, typeof Github> = {
  webhook: Github,
  api: Terminal,
  mcp: Server,
};

const sourceColors: Record<string, string> = {
  webhook: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  api: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  mcp: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const actionLabels: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  stage_changed: 'Stage Changed',
  listed: 'Listed',
};

export function ActivityLog({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLog = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    setEntries((data as ActivityEntry[]) || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchLog(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Activity className="w-4 h-4" />
          Activity Log
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchLog(true)}
          disabled={refreshing}
          className="h-7 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Recent updates from API, GitHub webhooks, and MCP server.
      </p>

      {entries.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          No activity yet. Updates from webhooks, API calls, and MCP interactions will appear here.
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-1.5 pr-3">
            {entries.map((entry) => {
              const Icon = sourceIcons[entry.source] || FileCode;
              const colorClass = sourceColors[entry.source] || 'bg-muted text-muted-foreground';
              const details = entry.details as Record<string, unknown> | null;

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 p-2 rounded-md border border-border/50 bg-card/50 text-xs"
                >
                  <div className={`rounded p-1 mt-0.5 shrink-0 ${colorClass}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        {entry.source}
                      </Badge>
                      <span className="font-medium">
                        {actionLabels[entry.action] || entry.action}
                      </span>
                      {entry.kabbo_yaml_detected && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">
                          .kabbo.yaml
                        </Badge>
                      )}
                    </div>
                    {entry.publication_title && (
                      <p className="text-muted-foreground truncate mt-0.5">
                        {entry.publication_title}
                      </p>
                    )}
                    {details?.stage && (
                      <span className="text-muted-foreground">
                        → {String(details.stage)}
                      </span>
                    )}
                    {details?.commit_message && (
                      <p className="text-muted-foreground truncate mt-0.5 italic">
                        "{String(details.commit_message)}"
                      </p>
                    )}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
