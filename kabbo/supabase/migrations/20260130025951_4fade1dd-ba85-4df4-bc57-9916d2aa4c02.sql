-- Create a security definer function to check if user can view another user's publications via team membership
CREATE OR REPLACE FUNCTION public.can_view_team_member_publications(_viewer_id uuid, _member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if viewer is admin/creator of any team where member is also a member
    SELECT 1
    FROM public.team_members viewer_tm
    INNER JOIN public.team_members member_tm 
      ON viewer_tm.team_id = member_tm.team_id
    INNER JOIN public.teams t 
      ON t.id = viewer_tm.team_id
    WHERE viewer_tm.user_id = _viewer_id
      AND viewer_tm.status = 'accepted'
      AND member_tm.user_id = _member_id
      AND member_tm.status = 'accepted'
      AND (
        t.created_by = _viewer_id  -- viewer is team creator
        OR viewer_tm.role = 'admin'  -- viewer is team admin
      )
  );
$$;

-- Create function to get team member's publications (respecting visibility settings)
CREATE OR REPLACE FUNCTION public.get_team_member_publications(_viewer_id uuid, _member_id uuid, _team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  min_stage text;
  min_stage_index int;
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
      'createdAt', p.created_at
    )
    ORDER BY p.updated_at DESC
  ), '[]'::jsonb)
  INTO result
  FROM public.publications p
  WHERE p.owner_id = _member_id
    AND public.get_stage_index(p.stage) >= min_stage_index;

  RETURN jsonb_build_object(
    'publications', result,
    'minVisibleStage', min_stage
  );
END;
$$;

-- Create function to get ALL team publications for aggregated dashboard (with filtering)
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

-- Add RLS policy to allow team admins to view member publications
CREATE POLICY "Team admins can view member publications"
ON public.publications
FOR SELECT
USING (
  -- Allow if viewer is admin of a team where owner is a member
  public.can_view_team_member_publications(auth.uid(), owner_id)
);

-- Add RLS policy to allow team admins to view member profiles  
CREATE POLICY "Team members can view teammate profiles"
ON public.profiles
FOR SELECT
USING (
  -- Allow viewing profiles of teammates in same team
  EXISTS (
    SELECT 1
    FROM public.team_members my_tm
    INNER JOIN public.team_members their_tm 
      ON my_tm.team_id = their_tm.team_id
    WHERE my_tm.user_id = auth.uid()
      AND my_tm.status = 'accepted'
      AND their_tm.user_id = profiles.id
      AND their_tm.status = 'accepted'
  )
);