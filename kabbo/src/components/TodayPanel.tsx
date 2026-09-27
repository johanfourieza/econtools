/**
 * TodayPanel – one header button with a count badge. Opens a short list of
 * what needs the researcher's attention (overdue reminders, revisions waiting,
 * decisions to chase, and so on). Replaces the old Insights carousel, which
 * sat on the canvas and had to be closed every session.
 *
 * Nothing on the dashboard moves when this opens; it is a popover.
 */

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TodayItem, TodayKind } from '../../supabase/functions/_shared/today';
import {
  Bell,
  BellRing,
  CalendarCheck,
  CalendarX,
  Check,
  Clock,
  Mail,
  PenLine,
  PartyPopper,
  Archive,
} from 'lucide-react';

interface TodayPanelProps {
  items: TodayItem[];
  onOpenPublication: (id: string) => void;
  onCompleteReminder: (id: string) => void;
  onShowPublished: () => void;
}

const SHOW_AT_MOST = 5;

const KIND_ICON: Record<TodayKind, React.ComponentType<{ className?: string }>> = {
  reminder_overdue: BellRing,
  reminder_due: Bell,
  revision_waiting: PenLine,
  no_decision: Mail,
  accepted_check: PartyPopper,
  draft_idle: Clock,
  reconsider: Archive,
  missing_year: CalendarX,
};

const KIND_COLOUR: Record<TodayKind, string> = {
  reminder_overdue: 'text-destructive',
  reminder_due: 'text-warm',
  revision_waiting: 'text-brand-ochre',
  no_decision: 'text-accent',
  accepted_check: 'text-sage',
  draft_idle: 'text-muted-foreground',
  reconsider: 'text-brand-ochre',
  missing_year: 'text-muted-foreground',
};

export function TodayPanel({ items, onOpenPublication, onCompleteReminder, onShowPublished }: TodayPanelProps) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const count = items.length;
  const visible = showAll ? items : items.slice(0, SHOW_AT_MOST);

  const handleItemClick = (item: TodayItem) => {
    if (item.publicationId) {
      onOpenPublication(item.publicationId);
      setOpen(false);
    } else if (item.kind === 'missing_year') {
      onShowPublished();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" title="What needs you today">
          <CalendarCheck className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Today</span>
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
            >
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="px-3 py-2 border-b border-border flex items-baseline justify-between">
          <span className="font-display font-medium text-sm">Today</span>
          <span className="text-xs text-muted-foreground">
            {count === 0 ? 'all clear' : `${count} item${count === 1 ? '' : 's'}`}
          </span>
        </div>

        {count === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Nothing needs you today.</p>
        ) : (
          <ul role="list" className="max-h-[60vh] overflow-y-auto py-1">
            {visible.map(item => {
              const Icon = KIND_ICON[item.kind];
              const clickable = !!item.publicationId || item.kind === 'missing_year';
              return (
                <li key={item.id} className="flex items-start gap-2 px-3 py-2 hover:bg-secondary/40">
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', KIND_COLOUR[item.kind])} />
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    disabled={!clickable}
                    className={cn('flex-1 min-w-0 text-left', clickable ? 'cursor-pointer' : 'cursor-default')}
                  >
                    <p className="text-sm leading-snug line-clamp-2">{item.message}</p>
                    {item.detail && (
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{item.detail}</p>
                    )}
                  </button>
                  {item.reminderId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      title="Mark done"
                      onClick={() => onCompleteReminder(item.reminderId!)}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {count > SHOW_AT_MOST && (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="w-full px-3 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground text-left"
          >
            {showAll ? 'Show fewer' : `Show all ${count}`}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
