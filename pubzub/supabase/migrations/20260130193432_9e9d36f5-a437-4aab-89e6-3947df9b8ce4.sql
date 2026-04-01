
-- Fix the has_dashboard_access function to properly handle the team creator and admin check
CREATE OR REPLACE FUNCTION public.has_dashboard_access(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Check if user is the team creator
    EXISTS (
      SELECT 1
      FROM public.teams
      WHERE id = _team_id
        AND created_by = auth.uid()
    )
    OR
    -- Check if user is a team admin
    EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = _team_id
        AND user_id = auth.uid()
        AND status = 'accepted'
        AND role = 'admin'::team_role
    )
    OR
    -- Check if user has explicit dashboard access
    EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = _team_id
        AND user_id = auth.uid()
        AND status = 'accepted'
        AND has_dashboard_access = true
    )
  );
$$;
