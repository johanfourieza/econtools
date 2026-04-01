-- Update the get_team_member_publications function to also include publications
-- where the member is listed as a co-author (in the authors array), not just as owner
CREATE OR REPLACE FUNCTION public.get_team_member_publications(_viewer_id uuid, _member_id uuid, _team_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  min_stage text;
  min_stage_index int;
  member_display_name text;
BEGIN
  -- Verify viewer has access (is admin of the team where member belongs)
  IF NOT EXISTS (
    SELECT 1
    FROM public.team_members viewer_tm
    INNER JOIN public.teams t ON t.id = viewer_tm.team_id
    WHERE viewer_tm.team_id = _team_id
      AND viewer_tm.user_id = _viewer_id
      AND viewer_tm.status = 'accepted'
      AND (t.created_by = _viewer_id OR viewer_tm.role = 'admin')
  ) THEN
    RETURN NULL;
  END IF;

  -- Get member's display name for matching in authors array
  SELECT display_name INTO member_display_name
  FROM public.profiles
  WHERE id = _member_id;

  -- Get member's visibility settings for this team
  SELECT COALESCE(vs.min_visible_stage::text, 'idea')
  INTO min_stage
  FROM public.visibility_settings vs
  WHERE vs.user_id = _member_id AND vs.team_id = _team_id;
  
  IF min_stage IS NULL THEN
    min_stage := 'idea';
  END IF;
  
  -- Get stage index
  min_stage_index := public.get_stage_index(min_stage);

  -- Fetch member's publications that meet visibility criteria
  -- Now includes papers where member is owner OR is listed in authors array
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'stage', p.stage,
      'authors', COALESCE(p.authors, ARRAY[]::text[]),
      'themes', COALESCE(p.themes, ARRAY[]::text[]),
      'grants', COALESCE(p.grants, ARRAY[]::text[]),
      'targetYear', p.target_year,
      'outputType', p.output_type,
      'updatedAt', p.updated_at,
      'createdAt', p.created_at,
      'ownerId', p.owner_id,
      'ownerName', (SELECT display_name FROM public.profiles WHERE id = p.owner_id)
    )
    ORDER BY p.updated_at DESC
  ), '[]'::jsonb)
  INTO result
  FROM public.publications p
  WHERE public.get_stage_index(p.stage) >= min_stage_index
    AND (
      p.owner_id = _member_id
      OR (member_display_name IS NOT NULL AND member_display_name = ANY(p.authors))
    )
    -- Only show publications from team members
    AND (
      p.owner_id IN (SELECT user_id FROM public.team_members WHERE team_id = _team_id AND status = 'accepted')
    );

  RETURN jsonb_build_object(
    'publications', result,
    'minVisibleStage', min_stage
  );
END;
$function$;