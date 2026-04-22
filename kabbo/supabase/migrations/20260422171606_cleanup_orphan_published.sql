-- Cleanup orphan "Untitled / Year unknown" publications and prevent recurrence.
--
-- Background: client-side write paths (updatePublication with a payload that
-- sets stageId='published' but omits publishedYear; and any addPublication
-- caller that passes stageId='published' on an empty row) could land rows
-- with stage='published', target_year=NULL, and title='Untitled' (schema
-- default). The React transform correctly buckets those into a "Year unknown"
-- column, which is how users noticed 78-odd of them on their boards.
--
-- Going forward we close the DB door so the pattern can't be stored again,
-- and we one-shot clean up the rows that are unambiguously garbage (empty
-- title + no authors + no notes + no themes).

BEGIN;

-- 1. Drop the garbage rows.
DELETE FROM public.publications
WHERE stage = 'published'
  AND target_year IS NULL
  AND (title IS NULL OR title = '' OR title = 'Untitled')
  AND (authors IS NULL OR cardinality(authors) = 0)
  AND (notes   IS NULL OR notes = '')
  AND (themes  IS NULL OR cardinality(themes) = 0);

-- 2. Prevent the pattern at the DB boundary.
ALTER TABLE public.publications
  ADD CONSTRAINT publications_published_requires_year
  CHECK (stage <> 'published' OR target_year IS NOT NULL);

COMMIT;
