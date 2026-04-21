/**
 * InsightsPanel — rule-based dashboard insights (Wave 1E).
 *
 * Shows between the FilterBar and the pipeline grid. Horizontal scroll row of
 * insight cards (stalled papers, missing data, momentum, accepted ready to
 * publish, this-week celebrations). Each card is dismissible with a 7-day
 * localStorage TTL. Panel collapses to a slim header row; default expanded
 * on desktop, collapsed on mobile.
 *
 * Display-only in v1 — no action buttons. Reads only; no mutations.
 */

import { Insight, InsightCategory } from '@/hooks/useInsights';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';

interface InsightsPanelProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

// Category → left-border colour class, using the existing palette tokens.
const CATEGORY_COLOUR: Record<InsightCategory, string> = {
  celebration: 'border-l-brand-ochre',
  quick_wins: 'border-l-sage',
  stalled: 'border-l-warm',
  missing_year: 'border-l-muted-foreground/60',
  missing_authors: 'border-l-muted-foreground/60',
  momentum: 'border-l-accent',
};

const CATEGORY_ICON_COLOUR: Record<InsightCategory, string> = {
  celebration: 'text-brand-ochre',
  quick_wins: 'text-sage',
  stalled: 'text-warm',
  missing_year: 'text-muted-foreground',
  missing_authors: 'text-muted-foreground',
  momentum: 'text-accent',
};

export function InsightsPanel({
  insights,
  onDismiss,
  isExpanded,
  onToggleExpanded,
}: InsightsPanelProps) {
  const count = insights.length;

  // Hide the panel entirely when there's nothing to show. Keeps the dashboard
  // clean on a quiet day — users aren't nagged when nothing needs attention.
  if (count === 0) return null;

  return (
    <section
      aria-label="Dashboard insights"
      className="flex-shrink-0 mb-2 md:mb-4 bg-card border border-border rounded-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-sm hover:bg-secondary/40 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium text-foreground/90">
          <Sparkles className="w-4 h-4 text-brand-ochre" />
          Insights
          <span className="text-muted-foreground font-normal">&middot; {count}</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3">
          <ul
            className="flex gap-2 overflow-x-auto pb-1"
            role="list"
          >
            {insights.map(insight => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={() => onDismiss(insight.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── card subcomponent ────────────────────────────────────────────────────
interface InsightCardProps {
  insight: Insight;
  onDismiss: () => void;
}

function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const borderColour = CATEGORY_COLOUR[insight.category];
  const iconColour = CATEGORY_ICON_COLOUR[insight.category];

  return (
    <li
      className={cn(
        'flex-shrink-0 w-[240px] min-h-[60px] bg-background border border-border border-l-4 rounded-lg px-3 py-2 flex gap-2 items-start group relative',
        borderColour,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1', iconColour)}>
          {CATEGORY_LABELS[insight.category]}
        </p>
        <p className="text-sm leading-snug text-foreground break-words">
          {insight.message}
        </p>
        {insight.detail && (
          <p className="text-xs text-muted-foreground italic leading-snug mt-1 line-clamp-2">
            {insight.detail}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        aria-label={`Dismiss insight: ${insight.message}`}
        // 'icon' is 40x40 by default — too big for our compact card. Override:
        className="h-6 w-6 -mt-0.5 -mr-1 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-secondary flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </li>
  );
}

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  celebration: 'Celebration',
  quick_wins: 'Quick win',
  stalled: 'Stalled',
  missing_year: 'Missing year',
  missing_authors: 'Missing author',
  momentum: 'Momentum',
};
