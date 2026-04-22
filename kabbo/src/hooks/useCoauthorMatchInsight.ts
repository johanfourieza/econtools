/**
 * useCoauthorMatchInsight – async sibling of `useInsights`.
 *
 * Flattens the user's co-author names across all their publications (excluding
 * themselves), then calls the `match_coauthors_on_kabbo` Supabase RPC to find
 * out how many of those co-authors already have Kabbo accounts. The RPC is
 * SECURITY DEFINER and returns aggregate counts only, so we never pull another
 * user's profile into the client.
 *
 * Separate from `computeInsights` because the core rule engine is intentionally
 * synchronous + pure (testable). This hook produces at most one `Insight`,
 * which `InsightsPanel` concatenates onto the synchronous list.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Publication } from '@/types/publication';
import { useAuth } from '@/hooks/useAuth';
import { parseList } from '@/lib/storage';
import type { Insight } from '@/hooks/useInsights';

export function useCoauthorMatchInsight(publications: Publication[]): Insight | null {
  const { profile, isAuthenticated } = useAuth();
  const [insight, setInsight] = useState<Insight | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !profile?.id) {
      setInsight(null);
      return;
    }

    const myName = (profile.displayName ?? '').trim().toLowerCase();
    const coauthors = Array.from(new Set(
      publications
        .flatMap(p => parseList(p.authors))
        .map(a => a.trim())
        .filter(a => a.length > 0 && a.toLowerCase() !== myName),
    ));

    if (coauthors.length === 0) {
      setInsight(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('match_coauthors_on_kabbo', {
        _authors: coauthors,
      });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setInsight(null);
        return;
      }
      const { matched_count, total_count } = data[0];
      if (!matched_count || matched_count < 1 || !total_count) {
        setInsight(null);
        return;
      }
      setInsight({
        id: `coauthors_on_kabbo:${matched_count}/${total_count}`,
        category: 'network',
        message:
          matched_count === 1
            ? `1 of your ${total_count} co-authors is on Kabbo`
            : `${matched_count} of your ${total_count} co-authors are on Kabbo`,
        detail: 'Invite the rest to collaborate directly.',
        priority: 400,
      });
    })();

    return () => {
      cancelled = true;
    };
    // Re-run whenever the set of co-author names changes. Stringifying the
    // sorted array gives us deterministic equality without lodash.
  }, [
    isAuthenticated,
    profile?.id,
    profile?.displayName,
    publications
      .map(p => p.authors)
      .sort()
      .join('|'),
  ]);

  return insight;
}
