/**
 * DispositionControl – pause or shelve a paper deliberately, with a reason
 * and an optional date to look at it again. Sits under the Stage row in the
 * drawer. An active paper shows one quiet link; a resting paper shows a
 * banner with the reason and a Reactivate button.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Archive, PauseCircle, Play } from 'lucide-react';
import type { Disposition } from '../../supabase/functions/_shared/pipeline';

interface DispositionControlProps {
  disposition: Disposition;
  reason: string;
  reconsiderAt: string; // YYYY-MM-DD or ''
  canEdit: boolean;
  onChange: (next: { disposition: Disposition; reason: string; reconsiderAt: string }) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function DispositionControl({ disposition, reason, reconsiderAt, canEdit, onChange }: DispositionControlProps) {
  const [editing, setEditing] = useState(false);
  const [draftDisposition, setDraftDisposition] = useState<Disposition>(disposition === 'active' ? 'paused' : disposition);
  const [draftReason, setDraftReason] = useState(reason);
  const [draftDate, setDraftDate] = useState(reconsiderAt);

  const openEditor = () => {
    setDraftDisposition(disposition === 'active' ? 'paused' : disposition);
    setDraftReason(reason);
    setDraftDate(reconsiderAt);
    setEditing(true);
  };

  const save = () => {
    onChange({ disposition: draftDisposition, reason: draftReason.trim(), reconsiderAt: draftDate });
    setEditing(false);
  };

  const reactivate = () => onChange({ disposition: 'active', reason: '', reconsiderAt: '' });

  if (editing) {
    return (
      <div className="space-y-2 p-2 bg-secondary/20 rounded-md">
        <div className="flex gap-2">
          {(['paused', 'shelved'] as Disposition[]).map(d => (
            <Button
              key={d}
              type="button"
              variant={draftDisposition === d ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setDraftDisposition(d)}
            >
              {d === 'paused' ? <PauseCircle className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {d === 'paused' ? 'Pause' : 'Shelve'}
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Paused stays on the board, dimmed. Shelved is tucked away under its column. Neither will nag you.
        </p>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Why</Label>
          <Input
            value={draftReason}
            onChange={e => setDraftReason(e.target.value)}
            placeholder="Waiting for data access; co-author on leave; null result"
            className="bg-secondary/30 text-xs"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Look at it again on (optional)</Label>
          <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} className="bg-secondary/30 text-xs" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" className="flex-1" onClick={save}>Save</Button>
        </div>
      </div>
    );
  }

  if (disposition === 'active') {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={openEditor}
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        Pause or shelve this paper
      </button>
    );
  }

  const Icon = disposition === 'paused' ? PauseCircle : Archive;
  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded-md border text-xs',
        disposition === 'paused' ? 'bg-warm/10 border-warm/30' : 'bg-secondary/40 border-border',
      )}
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{disposition === 'paused' ? 'Paused' : 'Shelved'}</p>
        {reason && <p className="text-muted-foreground">{reason}</p>}
        {reconsiderAt && <p className="text-muted-foreground">Look again on {formatDate(reconsiderAt)}</p>}
      </div>
      {canEdit && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          <Button variant="outline" size="sm" className="h-6 gap-1 text-[11px]" onClick={reactivate}>
            <Play className="w-3 h-3" />
            Reactivate
          </Button>
          <button type="button" onClick={openEditor} className="text-[10px] text-muted-foreground hover:underline text-right">
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
