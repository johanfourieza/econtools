-- Fix get_stage_index function to include search_path
CREATE OR REPLACE FUNCTION public.get_stage_index(_stage TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _stage
    WHEN 'idea' THEN 0
    WHEN 'draft' THEN 1
    WHEN 'submitted' THEN 2
    WHEN 'revise_resubmit' THEN 3
    WHEN 'resubmitted' THEN 4
    WHEN 'accepted' THEN 5
    WHEN 'published' THEN 6
    ELSE 0
  END;
$$;