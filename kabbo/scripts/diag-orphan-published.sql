-- Phase 1 diagnostic: orphan 'Untitled / Year unknown' rows.
-- Aggregate-only — does NOT surface any user's title/authors/notes text.

-- A. Per-owner summary. owner_id is a UUID (not PII).
SELECT owner_id,
       COUNT(*) AS total_pubs,
       COUNT(*) FILTER (WHERE stage = 'published' AND target_year IS NULL)                          AS orphan_published,
       COUNT(*) FILTER (WHERE stage = 'published' AND target_year IS NULL
                              AND (title IS NULL OR title = '' OR title = 'Untitled'))             AS orphan_untitled,
       COUNT(*) FILTER (WHERE stage = 'published' AND target_year IS NULL
                              AND (title IS NULL OR title = '' OR title = 'Untitled')
                              AND (authors IS NULL OR cardinality(authors) = 0)
                              AND (notes IS NULL OR notes = '')
                              AND (themes IS NULL OR cardinality(themes) = 0))                     AS orphan_strict
FROM publications
GROUP BY owner_id
HAVING COUNT(*) FILTER (WHERE stage = 'published' AND target_year IS NULL) > 0
ORDER BY orphan_published DESC;

-- B. Would any row with REAL data be spared by the strict predicate? Count only — no text.
SELECT COUNT(*) AS rows_with_some_real_data_NOT_swept
FROM publications
WHERE stage = 'published' AND target_year IS NULL
  AND NOT (
       (title IS NULL OR title = '' OR title = 'Untitled')
    AND (authors IS NULL OR cardinality(authors) = 0)
    AND (notes IS NULL OR notes = '')
    AND (themes IS NULL OR cardinality(themes) = 0)
  );

-- C. Cluster analysis — when were orphans created?
SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS n
FROM publications
WHERE stage = 'published' AND target_year IS NULL
  AND (title IS NULL OR title = '' OR title = 'Untitled')
GROUP BY 1
ORDER BY 1 DESC
LIMIT 30;

-- D. Global totals.
SELECT COUNT(*) AS all_pubs,
       COUNT(*) FILTER (WHERE stage = 'published') AS all_published,
       COUNT(*) FILTER (WHERE stage = 'published' AND target_year IS NULL) AS all_orphan_published
FROM publications;
