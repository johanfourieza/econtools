import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserProfile } from '@/types/publication';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Loader2, ExternalLink, Key, Copy, Trash2, Plus, Code, Terminal, BookOpen, FolderSync, Github, Server, Database, FileCode, Download, Bot, Sparkles } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ActivityLog } from './ActivityLog';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  onProfileUpdated: () => void;
}

// Hash a key using SHA-256 (same as edge function)
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function ApiKeysSection({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const ingestUrl = `https://${projectId}.supabase.co/functions/v1/ingest-publications`;

  const fetchKeys = async () => {
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setKeys((data as ApiKeyRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const generateKey = async () => {
    setCreating(true);
    try {
      // Generate a random API key
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const rawKey = 'pz_' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
      const keyHash = await hashKey(rawKey);
      const keyPrefix = rawKey.slice(0, 11); // "pz_" + 8 chars

      const { error } = await supabase
        .from('api_keys')
        .insert({
          user_id: userId,
          name: newKeyName.trim() || 'Default',
          key_hash: keyHash,
          key_prefix: keyPrefix,
        });

      if (error) throw error;

      setRevealedKey(rawKey);
      setNewKeyName('');
      fetchKeys();
      toast.success('API key created – copy it now, it won\'t be shown again');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from('api_keys').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete key');
    } else {
      toast.success('API key deleted');
      fetchKeys();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Ingest API Endpoint</p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{ingestUrl}</code>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard(ingestUrl, 'URL')}>
            <Copy className="w-3 h-3" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          POST with <code className="text-[11px]">x-api-key</code> header. Body: <code className="text-[11px]">{`{title, authors, stage, notes, ...}`}</code>
        </p>
      </div>

      {revealedKey && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-medium text-primary">New API Key – copy now!</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">{revealedKey}</code>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard(revealedKey, 'API key')}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">This key won't be shown again.</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => {
              const config = JSON.stringify({
                mcpServers: {
                  kabbo: {
                    type: "url",
                    url: `https://${projectId}.supabase.co/functions/v1/mcp-server?api_key=${revealedKey}`
                  }
                }
              }, null, 2);
              copyToClipboard(config, 'MCP config');
            }}>
              <Server className="w-3 h-3" />
              Copy MCP Config
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRevealedKey(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Key name (e.g. Overleaf sync)"
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={generateKey} disabled={creating} className="h-8 whitespace-nowrap">
          {creating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          Create Key
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No API keys yet. Create one to enable external integrations.</p>
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}•••</p>
                <p className="text-[11px] text-muted-foreground">
                  {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteKey(k.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationGuide() {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const ingestUrl = `https://${projectId}.supabase.co/functions/v1/ingest-publications`;
  const apiUrl = `https://${projectId}.supabase.co/functions/v1/api-publications`;
  const mcpUrl = `https://${projectId}.supabase.co/functions/v1/mcp-server`;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/github-webhook`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const curlExample = `curl -X POST "${ingestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "title": "My Paper Title",
    "authors": ["Alice Smith", "Bob Jones"],
    "stage": "draft",
    "notes": "Synced from Overleaf",
    "overleaf_link": "https://www.overleaf.com/project/abc123",
    "github_repo": "https://github.com/user/repo"
  }'`;

  const overleafPrompt = `I have a Kabbo ingest API at:
${ingestUrl}

It accepts POST with header "x-api-key: <key>" and JSON body:
{ title, authors[], stage, notes, overleaf_link, github_repo }

Valid stages: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published
(Also accepts aliases: wip→draft, r&r→revise_resubmit, in-review→submitted, etc.)

Write a script that:
1. Clones my Overleaf projects via git (I have premium git access)
2. Parses each main.tex for \\title{} and \\author{} metadata
3. POSTs each project to the ingest API with stage "draft" and the Overleaf project URL
4. Skips projects that haven't changed since last sync (use a local .last-sync file)
5. Runs via cron daily at 9am`;

  const dropboxPrompt = `I have a Kabbo ingest API at:
${ingestUrl}

It accepts POST with header "x-api-key: <key>" and JSON body:
{ title, authors[], stage, notes }

Valid stages: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published

I organise my papers in Dropbox with this folder structure:
Papers/
  Ideas/        → stage "idea"
  Drafts/       → stage "draft"
  Submitted/    → stage "submitted"
  Under Review/ → stage "revise_resubmit"
  Accepted/     → stage "accepted"
  Published/    → stage "published"

Each subfolder name is the paper title.

Write a script that:
1. Uses the Dropbox API to list folders under Papers/
2. Maps each folder's parent to a pipeline stage
3. POSTs each paper to the ingest API
4. Only syncs papers modified since last run
5. Runs via cron every 6 hours`;

  const githubSyncPrompt = `I have a Kabbo ingest API at:
${ingestUrl}

It accepts POST with header "x-api-key: <key>" and JSON body:
{ title, authors[], stage, notes, github_repo }

Valid stages: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published

I also have a GitHub webhook endpoint at:
${webhookUrl}?api_key=<key>

I keep my academic papers in separate GitHub repos. Each repo may contain a .kabbo.yaml file at the root that declares metadata:

# .kabbo.yaml
title: "My Paper Title"
stage: draft
authors:
  - Alice Smith
  - Bob Jones
themes:
  - climate
output_type: journal-article
target_year: 2025

If .kabbo.yaml exists, use its metadata instead of inferring from the repo name. Otherwise, fall back to extracting the title from the repo name (converting kebab-case/snake_case to Title Case) and checking commit messages for [stage:xxx] tags.

Write a script that:
1. Uses the GitHub API (with a personal access token) to list all my repos
2. For each repo, checks for .kabbo.yaml first – if found, use its metadata
3. If no .kabbo.yaml, extracts the paper title from the repo name and checks recent commits for [stage:xxx] tags
4. POSTs each paper to the ingest API with the detected metadata and the GitHub repo URL
5. Optionally sets up the Kabbo webhook on each repo that doesn't have it yet (using the webhook URL above)
6. Saves a .kabbo-last-sync file to skip repos that haven't changed
7. Can be run manually or via cron daily at 9am

The script should:
- Accept --github-token, --kabbo-api-key, and --github-username as CLI arguments
- Have a --dry-run flag to preview changes without pushing
- Print a summary table of all repos and their detected stages
- Skip repos that are forks or archived
- Have an --init flag that creates a .kabbo.yaml template in repos that don't have one`;

  const skillFileUrl = `${window.location.origin}/skill.md`;
  const curlInstall = `mkdir -p ~/.claude/skills/kabbo && curl -o ~/.claude/skills/kabbo/skill.md ${skillFileUrl}`;

  return (
    <div className="space-y-4 pt-2 border-t border-border">
      {/* AI Integration intro */}
      <div>
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          AI Integration
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Kabbo works with AI coding assistants so you can manage your publication
          pipeline from the command line or chat. Ask questions like "How's my
          pipeline looking?" or "Which papers have been stuck longest?" and get
          structured answers from your own data.
        </p>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Claude Code card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Claude Code</p>
              <p className="text-[10px] text-muted-foreground">by Anthropic</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            A CLI assistant that runs in your terminal. Install the Kabbo skill
            file to give it access to all 16 pipeline tools via the{' '}
            <code className="bg-muted px-1 rounded text-[10px]">/kabbo</code> command.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
              const a = document.createElement('a');
              a.href = skillFileUrl;
              a.download = 'skill.md';
              a.click();
            }}>
              <Download className="w-3 h-3" />
              Download skill.md
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(curlInstall)}>
              <Copy className="w-3 h-3" />
              Copy install command
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Place in <code className="bg-muted px-0.5 rounded text-[9px]">~/.claude/skills/kabbo/skill.md</code>
          </p>
        </div>

        {/* Codex card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Codex</p>
              <p className="text-[10px] text-muted-foreground">by OpenAI</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            An AI coding agent that reads an{' '}
            <code className="bg-muted px-1 rounded text-[10px]">AGENTS.md</code> file
            in your project. Clone the Kabbo repo and Codex will automatically
            discover the pipeline tools.
          </p>
          <div className="flex gap-2 pt-1">
            <a
              href="https://github.com/johanfourieza/econtools/blob/main/kabbo/AGENTS.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <ExternalLink className="w-3 h-3" />
                View AGENTS.md
              </Button>
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Place in your project root. Codex reads it automatically.
          </p>
        </div>
      </div>

      {/* What you need section */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium mb-2">What you need to get started:</p>
        <ol className="text-[11px] text-muted-foreground list-decimal ml-4 space-y-1">
          <li>Create an <strong>API key</strong> in the section above</li>
          <li>Download the <strong>skill file</strong> (Claude Code) or <strong>AGENTS.md</strong> (Codex) using the buttons above</li>
          <li>Copy your <strong>MCP config</strong> (shown when you create a key) into your Claude Code settings</li>
          <li>Ask Claude Code: <em>"How's my pipeline looking?"</em></li>
        </ol>
      </div>

      {/* Detailed integration guides */}
      <div>
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" />
          Integration guides
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Detailed setup for specific platforms and sync workflows.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="github-webhook">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <Github className="w-3.5 h-3.5" />
              GitHub Webhook (Auto-Sync)
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Automatically update your pipeline when you push to a paper's GitHub repo.</p>
              
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{webhookUrl}?api_key=YOUR_API_KEY</code>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard(`${webhookUrl}?api_key=YOUR_API_KEY`)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-2">
                <p className="font-medium">Setup (one-time per repo):</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Create an API key above if you haven't already</li>
                  <li>Go to your GitHub repo → <strong>Settings → Webhooks → Add webhook</strong></li>
                  <li>Paste the Webhook URL above (replace <code className="bg-muted px-1 rounded">YOUR_API_KEY</code> with your actual key)</li>
                  <li>Set Content type to <code className="bg-muted px-1 rounded">application/json</code></li>
                  <li>For Secret, you can leave it blank (API key provides authentication) or set one for extra security</li>
                  <li>Select <strong>"Just the push event"</strong></li>
                </ol>

                <p className="font-medium pt-2">Commit message tags:</p>
                <p>Include a <code className="bg-muted px-1 rounded">[stage:xxx]</code> tag in your commit message to move the card:</p>
                <div className="space-y-1 mt-1">
                  <p><code className="bg-muted px-1 rounded">git commit -m "Updated methods [stage:draft]"</code></p>
                  <p><code className="bg-muted px-1 rounded">git commit -m "Submitted to AER [stage:submitted]"</code></p>
                  <p><code className="bg-muted px-1 rounded">git commit -m "R&R changes [stage:revise_resubmit]"</code></p>
                </div>
                <p className="pt-1">Valid tags: <code className="bg-muted px-1 rounded">idea</code> · <code className="bg-muted px-1 rounded">draft</code> · <code className="bg-muted px-1 rounded">submitted</code> · <code className="bg-muted px-1 rounded">revise_resubmit</code> · <code className="bg-muted px-1 rounded">resubmitted</code> · <code className="bg-muted px-1 rounded">accepted</code> · <code className="bg-muted px-1 rounded">published</code></p>
                <p className="pt-1">Pushes without a tag still link the repo to the card (matched by repo name).</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="quickstart">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Quick Start (curl)
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Test the API with this curl command. Replace <code className="text-[11px] bg-muted px-1 rounded">YOUR_API_KEY</code> with a key from above.</p>
              <div className="relative">
                <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{curlExample}</pre>
                <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => copyToClipboard(curlExample)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium">Stage mapping reference:</p>
                <p><code className="bg-muted px-1 rounded">idea</code> · <code className="bg-muted px-1 rounded">draft</code> · <code className="bg-muted px-1 rounded">submitted</code> · <code className="bg-muted px-1 rounded">revise_resubmit</code> · <code className="bg-muted px-1 rounded">resubmitted</code> · <code className="bg-muted px-1 rounded">accepted</code> · <code className="bg-muted px-1 rounded">published</code></p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="overleaf">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5" />
              Overleaf Integration
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Give this prompt to Claude Code to auto-sync your Overleaf projects. Requires Overleaf premium (git access).</p>
              <div className="relative">
                <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{overleafPrompt}</pre>
                <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => copyToClipboard(overleafPrompt)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dropbox">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <FolderSync className="w-3.5 h-3.5" />
              Dropbox Integration
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Give this prompt to Claude Code to sync papers from your Dropbox folder structure.</p>
              <div className="relative">
                <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{dropboxPrompt}</pre>
                <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => copyToClipboard(dropboxPrompt)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="github-sync">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <Github className="w-3.5 h-3.5" />
              GitHub Full Sync (Claude Code)
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Give this prompt to Claude Code to scan all your GitHub repos and sync them to Kabbo. Complements the webhook for a full periodic reconciliation.</p>
              <div className="relative">
                <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{githubSyncPrompt}</pre>
                <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => copyToClipboard(githubSyncPrompt)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="kabbo-yaml">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              .kabbo.yaml Config Convention
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Add a <code className="bg-muted px-1 rounded">.kabbo.yaml</code> file to the root of any paper repo to declare its metadata. The webhook and sync scripts auto-discover it – no manual configuration needed.
              </p>

              <div className="relative">
                <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{`# .kabbo.yaml – drop this in any paper repo root
title: "Effect of Climate Policy on Trade Flows"
stage: draft
authors:
  - Alice Smith
  - Bob Jones
output_type: journal-article
target_year: 2025
themes:
  - climate
  - trade
grants:
  - ERC-2024-001
overleaf_url: https://www.overleaf.com/project/abc123
notes: "Working on methods section"
links:
  - https://data.worldbank.org/dataset/xyz`}</pre>
                <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => copyToClipboard(`# .kabbo.yaml – drop this in any paper repo root
title: "Effect of Climate Policy on Trade Flows"
stage: draft
authors:
  - Alice Smith
  - Bob Jones
output_type: journal-article
target_year: 2025
themes:
  - climate
  - trade
grants:
  - ERC-2024-001
overleaf_url: https://www.overleaf.com/project/abc123
notes: "Working on methods section"
links:
  - https://data.worldbank.org/dataset/xyz`)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-2">
                <p className="font-medium">How it works:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li><strong>GitHub Webhook:</strong> On every push, the webhook fetches <code className="bg-muted px-1 rounded">.kabbo.yaml</code> from your repo's default branch and applies the metadata automatically.</li>
                  <li><strong>Claude Code Sync:</strong> The full sync script checks each repo for <code className="bg-muted px-1 rounded">.kabbo.yaml</code> before falling back to repo-name inference.</li>
                  <li><strong>Commit tags override:</strong> A <code className="bg-muted px-1 rounded">[stage:submitted]</code> commit tag always takes priority over the yaml's stage field.</li>
                </ul>

                <p className="font-medium pt-2">All supported fields:</p>
                <div className="space-y-0.5">
                  <p><code className="bg-muted px-1 rounded">title</code> – Paper title (otherwise inferred from repo name)</p>
                  <p><code className="bg-muted px-1 rounded">stage</code> – Pipeline stage (idea, draft, submitted, revise_resubmit, resubmitted, accepted, published)</p>
                  <p><code className="bg-muted px-1 rounded">authors</code> – List of author names</p>
                  <p><code className="bg-muted px-1 rounded">output_type</code> – journal-article, book, chapter</p>
                  <p><code className="bg-muted px-1 rounded">target_year</code> – Target completion year</p>
                  <p><code className="bg-muted px-1 rounded">themes</code> – Research themes/tags</p>
                  <p><code className="bg-muted px-1 rounded">grants</code> – Associated grant IDs</p>
                  <p><code className="bg-muted px-1 rounded">overleaf_url</code> – Link to Overleaf project</p>
                  <p><code className="bg-muted px-1 rounded">notes</code> – Free-text notes</p>
                  <p><code className="bg-muted px-1 rounded">links</code> – List of related URLs</p>
                </div>

                <p className="font-medium pt-2">Quick init with Claude Code:</p>
                <p><em>"Run the sync script with --init to generate .kabbo.yaml templates in all my paper repos"</em></p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="mcp-server">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              MCP Server (Claude Code Native)
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Connect Claude Code directly to Kabbo using the <strong>Model Context Protocol</strong>. Claude Code can then list, create, update, move, and delete publications natively – no scripts needed.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">MCP Server URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{mcpUrl}</code>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard(mcpUrl)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-2">
                <p className="font-medium">Setup in Claude Code:</p>
                <p>Add to your <code className="bg-muted px-1 rounded">~/.claude/settings.json</code> or project <code className="bg-muted px-1 rounded">.mcp.json</code>:</p>
                <div className="relative">
                  <pre className="text-[11px] bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{`{
  "mcpServers": {
    "kabbo": {
      "type": "url",
      "url": "${mcpUrl}?api_key=YOUR_API_KEY"
    }
  }
}`}</pre>
                  <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => copyToClipboard(`{\n  "mcpServers": {\n    "kabbo": {\n      "type": "url",\n      "url": "${mcpUrl}?api_key=YOUR_API_KEY"\n    }\n  }\n}`)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                <p className="pt-2 pb-1 font-medium">Test connection:</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste your API key to test"
                    className="h-7 text-[11px] font-mono"
                    id="mcp-test-key"
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs whitespace-nowrap gap-1" onClick={async () => {
                    const key = (document.getElementById('mcp-test-key') as HTMLInputElement)?.value;
                    if (!key) { toast.error('Paste an API key first'); return; }
                    try {
                      const res = await fetch(`${mcpUrl}?api_key=${encodeURIComponent(key)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'kabbo-test', version: '1.0.0' } }, id: 1 }),
                      });
                      if (res.ok) { toast.success('MCP server connected successfully'); }
                      else { toast.error(`Connection failed (${res.status})`); }
                    } catch { toast.error('Connection failed – check your network'); }
                  }}>
                    <Server className="w-3 h-3" />
                    Test
                  </Button>
                </div>

                <p className="font-medium pt-2">Available tools (16):</p>
                <div className="space-y-1">
                  <p><code className="bg-muted px-1 rounded">list_publications</code> – List all publications with optional filters</p>
                  <p><code className="bg-muted px-1 rounded">get_publication</code> – Get a single publication by ID</p>
                  <p><code className="bg-muted px-1 rounded">create_publication</code> – Create a new publication</p>
                  <p><code className="bg-muted px-1 rounded">update_publication</code> – Update any field on a publication</p>
                  <p><code className="bg-muted px-1 rounded">move_stage</code> – Move a publication to a different stage</p>
                  <p><code className="bg-muted px-1 rounded">delete_publication</code> – Soft-delete (bin) a publication</p>
                  <p><code className="bg-muted px-1 rounded">get_pipeline_summary</code> – Pipeline overview: counts by stage, stalled and recent papers</p>
                  <p><code className="bg-muted px-1 rounded">search_publications</code> – Search across title, authors, notes, themes, grants</p>
                  <p><code className="bg-muted px-1 rounded">bulk_update</code> – Update multiple publications at once</p>
                  <p><code className="bg-muted px-1 rounded">get_activity_log</code> – Recent activity from all sources with date filtering</p>
                  <p><code className="bg-muted px-1 rounded">manage_reminders</code> – Create, list, complete, or delete reminders</p>
                  <p><code className="bg-muted px-1 rounded">get_analytics</code> – Velocity, time per stage, breakdowns by author/theme/grant</p>
                  <p><code className="bg-muted px-1 rounded">get_team_summary</code> – Team pipeline: papers by stage per member</p>
                  <p><code className="bg-muted px-1 rounded">export_bibtex</code> – Generate BibTeX for your publications</p>
                  <p><code className="bg-muted px-1 rounded">add_note</code> – Append a timestamped note to a publication</p>
                  <p><code className="bg-muted px-1 rounded">get_stalled_papers</code> – Papers inactive for 30+ days, sorted by staleness</p>
                </div>

                <p className="font-medium pt-2">Example prompts in Claude Code:</p>
                <p><em>"How's my pipeline looking?"</em></p>
                <p><em>"Which papers have been stuck longest?"</em></p>
                <p><em>"How many papers did I publish this year vs last year?"</em></p>
                <p><em>"Find all papers about colonial wages"</em></p>
                <p><em>"Add a note to the climate paper: reviewer 2 wants robustness checks"</em></p>
                <p><em>"How are my students' papers progressing?"</em></p>
                <p><em>"Remind me to resubmit by June 15"</em></p>
                <p><em>"Give me BibTeX for all published papers since 2024"</em></p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="crud-api">
          <AccordionTrigger className="text-sm py-2">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Full CRUD API Reference
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Full REST API for listing, updating, and deleting publications. All requests need <code className="bg-muted px-1 rounded">x-api-key</code> header.
              </p>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Base URL</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{apiUrl}</code>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyToClipboard(apiUrl)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-2">
                <p className="font-medium">GET – List publications</p>
                <p><code className="bg-muted px-1 rounded">?q=search</code> <code className="bg-muted px-1 rounded">?stage=draft</code> <code className="bg-muted px-1 rounded">?id=UUID</code> <code className="bg-muted px-1 rounded">?limit=50&offset=0</code></p>

                <p className="font-medium pt-1">PATCH – Update a publication</p>
                <p>Body: <code className="bg-muted px-1 rounded">{`{ "id": "...", "stage": "submitted", "notes": "..." }`}</code></p>

                <p className="font-medium pt-1">DELETE – Bin a publication</p>
                <p><code className="bg-muted px-1 rounded">?id=UUID</code></p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  profile,
  onProfileUpdated,
}: ProfileSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    displayName: profile.displayName || '',
    universityAffiliation: profile.universityAffiliation || '',
    googleScholarUrl: profile.googleScholarUrl || '',
    personalWebsiteUrl: profile.personalWebsiteUrl || '',
    orcidId: profile.orcidId || '',
    autoIncludeMeInAuthors: profile.autoIncludeMeInAuthors ?? true,
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      toast.success('Avatar updated');
      onProfileUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      try {
        const parsed = new URL(`https://${url}`);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }
  };

  const normalizeUrl = (url: string): string => {
    if (!url) return url;
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const isValidOrcid = (orcid: string): boolean => {
    if (!orcid) return true;
    const cleanOrcid = orcid.replace(/-/g, '');
    return /^\d{15}[\dX]$/.test(cleanOrcid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const googleScholarUrl = formData.googleScholarUrl.trim();
      const personalWebsiteUrl = formData.personalWebsiteUrl.trim();
      const orcidId = formData.orcidId.trim();

      if (googleScholarUrl && !isValidUrl(googleScholarUrl)) {
        toast.error('Google Scholar URL must be a valid http/https URL');
        setLoading(false);
        return;
      }

      if (personalWebsiteUrl && !isValidUrl(personalWebsiteUrl)) {
        toast.error('Personal website URL must be a valid http/https URL');
        setLoading(false);
        return;
      }

      if (orcidId && !isValidOrcid(orcidId)) {
        toast.error('ORCID iD should be in format: 0000-0000-0000-0000');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.displayName.trim() || null,
          university_affiliation: formData.universityAffiliation.trim() || null,
          google_scholar_url: googleScholarUrl ? normalizeUrl(googleScholarUrl) : null,
          personal_website_url: personalWebsiteUrl ? normalizeUrl(personalWebsiteUrl) : null,
          orcid_id: orcidId || null,
          auto_include_me_in_authors: formData.autoIncludeMeInAuthors,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile updated');
      onProfileUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (formData.displayName) {
      return formData.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'U';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="developer" className="flex items-center gap-1">
              <Code className="w-3 h-3" />
              Developer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={profile.avatarUrl} alt={formData.displayName} />
                    <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Click camera to upload photo</p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="universityAffiliation">University Affiliation</Label>
                  <Input
                    id="universityAffiliation"
                    value={formData.universityAffiliation}
                    onChange={(e) => setFormData(prev => ({ ...prev, universityAffiliation: e.target.value }))}
                    placeholder="e.g., University of Oxford"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="googleScholarUrl" className="flex items-center gap-1">
                    Google Scholar
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </Label>
                  <Input
                    id="googleScholarUrl"
                    type="text"
                    value={formData.googleScholarUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, googleScholarUrl: e.target.value }))}
                    placeholder="scholar.google.com/citations?user=..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personalWebsiteUrl" className="flex items-center gap-1">
                    Personal Website
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </Label>
                  <Input
                    id="personalWebsiteUrl"
                    type="text"
                    value={formData.personalWebsiteUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, personalWebsiteUrl: e.target.value }))}
                    placeholder="yourwebsite.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orcidId">ORCID iD</Label>
                  <Input
                    id="orcidId"
                    value={formData.orcidId}
                    onChange={(e) => setFormData(prev => ({ ...prev, orcidId: e.target.value }))}
                    placeholder="0000-0000-0000-0000"
                  />
                </div>
              </div>

              {/* Author preferences */}
              <div className="border-t border-border pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="auto-include-me" className="font-medium">
                      Include my name in new publications
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      When on, new publications pre-fill the authors field with your display name.
                      Dashboard cards still show only your co-authors.
                    </p>
                  </div>
                  <Switch
                    id="auto-include-me"
                    checked={formData.autoIncludeMeInAuthors}
                    onCheckedChange={(v) =>
                      setFormData(prev => ({ ...prev, autoIncludeMeInAuthors: v }))
                    }
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="developer" className="mt-4">
            <div className="space-y-3 overflow-x-hidden">
              <ActivityLog userId={profile.id} />
              <div className="border-t border-border pt-3">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Key className="w-4 h-4" />
                  API Keys
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate keys to push publications from external tools (Overleaf, Dropbox, scripts).
                </p>
              </div>
              <ApiKeysSection userId={profile.id} />
              <IntegrationGuide />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}