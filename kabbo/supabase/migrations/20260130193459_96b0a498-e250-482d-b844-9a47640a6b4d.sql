
-- Update get_team_all_publications to include working_paper data
CREATE OR REPLACE FUNCTION public.get_team_all_publications(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Verify caller has dashboard access
  IF NOT public.has_dashboard_access(_team_id) THEN
    RETURN NULL;
  END IF;

  -- Get all publications from all team members, respecting their visibility settings
  WITH member_visibility AS (
    SELECT 
      tm.user_id,
      COALESCE(vs.min_visible_stage::text, 'idea') as min_stage,
      public.get_stage_index(COALESCE(vs.min_visible_stage::text, 'idea')) as min_stage_index
    FROM public.team_members tm
    LEFT JOIN public.visibility_settings vs 
      ON vs.user_id = tm.user_id AND vs.team_id = _team_id
    WHERE tm.team_id = _team_id
      AND tm.status = 'accepted'
      AND tm.user_id IS NOT NULL
  ),
  visible_publications AS (
    SELECT 
      p.id,
      p.title,
      p.stage,
      p.authors,
      p.themes,
      p.grants,
      p.target_year,
      p.output_type,
      p.updated_at,
      p.created_at,
      p.owner_id,
      p.working_paper,
      pr.display_name as owner_name,
      pr.avatar_url as owner_avatar
    FROM public.publications p
    INNER JOIN member_visibility mv ON mv.user_id = p.owner_id
    LEFT JOIN public.profiles pr ON pr.id = p.owner_id
    WHERE public.get_stage_index(p.stage) >= mv.min_stage_index
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', vp.id,
      'title', vp.title,
      'stage', vp.stage,
      'authors', COALESCE(vp.authors, ARRAY[]::text[]),
      'themes', COALESCE(vp.themes, ARRAY[]::text[]),
      'grants', COALESCE(vp.grants, ARRAY[]::text[]),
      'targetYear', vp.target_year,
      'outputType', vp.output_type,
      'workingPaper', vp.working_paper,
      'updatedAt', vp.updated_at,
      'createdAt', vp.created_at,
      'ownerId', vp.owner_id,
      'ownerName', vp.owner_name,
      'ownerAvatar', vp.owner_avatar
    )
    ORDER BY vp.updated_at DESC
  ), '[]'::jsonb)
  INTO result
  FROM visible_publications vp;

  RETURN result;
END;
$$;
