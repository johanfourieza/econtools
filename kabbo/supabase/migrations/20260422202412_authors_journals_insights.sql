-- Authors / journals / Insights rework.
--
-- 1. target_journal column so the drawer's "Intended journal" input actually
--    survives a reload (previously routed through the un-persisted typeA field).
-- 2. auto_include_me_in_authors per-user setting. Default true: new
--    publications pre-fill the authors field with the signed-in user's
--    display_name, keeping the data model honest (authors = full ordered list,
--    always including self). Settings UI lets users opt out.
-- 3. match_coauthors_on_kabbo RPC returns only counts so we can surface the
--    "N of your M co-authors are on Kabbo" insight without exposing any
--    profile data across the RLS boundary.

BEGIN;

ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS target_journal TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_include_me_in_authors BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.match_coauthors_on_kabbo(_authors TEXT[])
RETURNS TABLE(matched_count INT, total_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE lower(trim(p.display_name)) = lower(trim(a))
          AND p.id <> auth.uid()
      )
    )::INT AS matched_count,
    COUNT(*)::INT AS total_count
  FROM unnest(_authors) AS a
  WHERE trim(a) <> '';
END;
$$;

REVOKE ALL   ON FUNCTION public.match_coauthors_on_kabbo(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_coauthors_on_kabbo(TEXT[]) TO authenticated;

COMMIT;
