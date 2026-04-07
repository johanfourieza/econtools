-- Fix: Allow users with pending team invitations to view the team they're invited to
-- This is needed so invitees can see team names in their invitation list

-- Drop existing policy
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;

-- Create updated policy that includes pending invitees
CREATE POLICY "Team members and invitees can view teams" 
ON public.teams 
FOR SELECT 
USING (
  is_team_member(id) 
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = id
    AND tm.user_id = auth.uid()
    AND tm.status = 'pending'
  )
);

-- Fix has_dashboard_access to properly handle enum comparison
CREATE OR REPLACE FUNCTION public.has_dashboard_access(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = auth.uid()
      AND status = 'accepted'
      AND (role::text = 'admin' OR has_dashboard_access = true)
  )
  OR EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND created_by = auth.uid()
  );
$$;

-- Fix is_team_admin to properly handle enum comparison  
CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = auth.uid()
      AND role::text = 'admin'
      AND status = 'accepted'
  );
$$;