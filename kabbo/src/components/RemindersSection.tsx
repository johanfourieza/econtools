/**
 * RemindersSection – the compact "Reminders" block inside the publication
 * drawer: open reminders for this paper, tick to complete, and a one-line
 * add form (title + date). Types default to "general"; the agent path can set
 * the others.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Bell, Check, Plus, X } from 'lucide-react';
import { dueStatusFor, type NewReminder, type ReminderRow } from '@/hooks/useReminders';

interface RemindersSectionProps {
  publicationId: string;
  reminders: ReminderRow[];
  canEdit: boolean;
  onAdd: (input: NewReminder) => Promise<ReminderRow | null>;
  onComplete: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

function formatDue(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function RemindersSection({ publicationId, reminders, canEdit, onAdd, onComplete, onDelete }: RemindersSectionProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    const row = await onAdd({ publicationId, title, dueDate: date });
    setSaving(false);
    if (row) {
      setTitle('');
      setDate('');
      setAdding(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-display font-medium text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          Reminders
        </h4>
        {canEdit && !adding && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setAdding(true)}>
            <Plus className="w-3 h-3" />
            Add
          </Button>
        )}
      </div>

      {reminders.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No reminders. Add one for a resubmission deadline or a conference.</p>
      )}

      {reminders.length > 0 && (
        <ul className="space-y-1.5">
          {reminders.map(r => {
            const status = dueStatusFor([r]);
            return (
              <li key={r.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  title="Mark done"
                  disabled={!canEdit}
                  onClick={() => onComplete(r.id)}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{r.title}</p>
                  <p
                    className={cn(
                      'text-[10px]',
                      status === 'overdue' ? 'text-destructive' : status === 'due_soon' ? 'text-warm' : 'text-muted-foreground',
                    )}
                  >
                    {status === 'overdue' ? 'Overdue · ' : ''}{formatDue(r.dueDate)}
                  </p>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" title="Delete" onClick={() => onDelete(r.id)}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className="space-y-2 p-2 bg-secondary/20 rounded-md">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">What</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Resubmit revised version"
              className="bg-secondary/30 text-xs"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">When</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-secondary/30 text-xs"
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { setAdding(false); setTitle(''); setDate(''); }}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={submit} disabled={saving || !title.trim() || !date}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
