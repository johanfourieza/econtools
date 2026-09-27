/**
 * SubmissionHistory – the "Journal history" block in the publication drawer.
 * One compact row per journal the paper was sent to, most recent first, with
 * the decision editable in place, and an "Add submission" form.
 *
 * Recording a decision also moves the paper (the drawer applies
 * stageForDecision); the user can always override the Stage select.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BookOpen, Plus, RotateCcw, X } from 'lucide-react';
import {
  DECISIONS,
  DECISION_LABELS,
  stageForDecision,
  type Decision,
} from '../../supabase/functions/_shared/pipeline';
import type { AttemptPatch, NewAttempt, SubmissionAttempt } from '@/hooks/useSubmissionAttempts';
import { todayIso } from '@/hooks/useSubmissionAttempts';

interface SubmissionHistoryProps {
  publicationId: string;
  /** The paper's intended journal, used to prefill a new submission. */
  journalHint: string;
  attempts: SubmissionAttempt[];
  canEdit: boolean;
  onAdd: (input: NewAttempt) => Promise<SubmissionAttempt | null>;
  onUpdate: (id: string, patch: AttemptPatch) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  /** Called after a decision or resubmission is recorded, with the stage it implies. */
  onStageImplied: (stage: string) => void;
}

const DECISION_TONE: Record<Decision, string> = {
  pending: 'text-muted-foreground',
  desk_reject: 'text-destructive',
  reject: 'text-destructive',
  revise_resubmit: 'text-brand-ochre',
  accept: 'text-sage',
  withdrawn: 'text-muted-foreground',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function SubmissionHistory({
  publicationId,
  journalHint,
  attempts,
  canEdit,
  onAdd,
  onUpdate,
  onDelete,
  onStageImplied,
}: SubmissionHistoryProps) {
  const [adding, setAdding] = useState(false);
  const [journal, setJournal] = useState('');
  const [submittedAt, setSubmittedAt] = useState(todayIso());
  const [manuscriptNumber, setManuscriptNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const startAdding = () => {
    setJournal(journalHint || '');
    setSubmittedAt(todayIso());
    setManuscriptNumber('');
    setAdding(true);
  };

  const submit = async () => {
    if (!journal.trim()) return;
    setSaving(true);
    const row = await onAdd({ publicationId, journal, submittedAt, manuscriptNumber });
    setSaving(false);
    if (row) {
      setAdding(false);
      onStageImplied('submitted');
    }
  };

  const setDecision = async (a: SubmissionAttempt, decision: Decision) => {
    const patch: AttemptPatch = {
      decision,
      decisionAt: decision === 'pending' ? null : (a.decisionAt || todayIso()),
    };
    const ok = await onUpdate(a.id, patch);
    if (ok) {
      const stage = stageForDecision(decision);
      if (stage) onStageImplied(stage);
    }
  };

  const resubmitted = async (a: SubmissionAttempt) => {
    const ok = await onUpdate(a.id, { decision: 'pending', decisionAt: null, rounds: a.rounds + 1 });
    if (ok) onStageImplied('resubmitted');
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-display font-medium text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          Journal history
        </h4>
        {canEdit && !adding && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={startAdding}>
            <Plus className="w-3 h-3" />
            Add submission
          </Button>
        )}
      </div>

      {attempts.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">
          Not submitted anywhere yet. Record each journal you send it to; rejections stay on the record.
        </p>
      )}

      {attempts.length > 0 && (
        <ul className="space-y-1.5">
          {attempts.map(a => (
            <li key={a.id} className="p-2 bg-secondary/30 rounded-md space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.journal}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Submitted {formatDate(a.submittedAt)}
                    {a.rounds > 0 ? ` · round ${a.rounds + 1}` : ''}
                    {a.manuscriptNumber ? ` · ${a.manuscriptNumber}` : ''}
                    {a.decision !== 'pending' && a.decisionAt ? ` · ${DECISION_LABELS[a.decision].toLowerCase()} ${formatDate(a.decisionAt)}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" title="Remove" onClick={() => onDelete(a.id)}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <Select value={a.decision} onValueChange={(v: Decision) => setDecision(a, v)}>
                    <SelectTrigger className={cn('h-7 bg-secondary/30 text-xs flex-1', DECISION_TONE[a.decision])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DECISIONS.map(d => (
                        <SelectItem key={d} value={d}>{DECISION_LABELS[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {a.decision === 'revise_resubmit' && (
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => resubmitted(a)} title="Record that the revised version went back">
                      <RotateCcw className="w-3 h-3" />
                      Resubmitted
                    </Button>
                  )}
                </div>
              ) : (
                <p className={cn('text-xs', DECISION_TONE[a.decision])}>{DECISION_LABELS[a.decision]}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-2 p-2 bg-secondary/20 rounded-md">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Journal</Label>
            <Input
              value={journal}
              onChange={e => setJournal(e.target.value)}
              placeholder="e.g. Journal of Economic History"
              className="bg-secondary/30 text-xs"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Submitted on</Label>
              <Input type="date" value={submittedAt} onChange={e => setSubmittedAt(e.target.value)} className="bg-secondary/30 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Manuscript no.</Label>
              <Input value={manuscriptNumber} onChange={e => setManuscriptNumber(e.target.value)} placeholder="Optional" className="bg-secondary/30 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" className="flex-1" onClick={submit} disabled={saving || !journal.trim() || !submittedAt}>Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}
