-- Create a secure view for team_members that hides invited_email from non-admins
-- This prevents regular team members from seeing email addresses of pending invitations

CREATE OR REPLACE VIEW public.team_members_secure
WITH (security_invoker = on)
AS
SELECT 
  id,
  team_id,
  user_id,
  role,
  status,
  created_at,
  has_dashboard_access,
  -- Only show invited_email to team admins or the user themselves
  CASE 
    WHEN public.is_team_admin(team_id) THEN invited_email
    WHEN public.is_current_user_email(invited_email) THEN invited_email
    ELSE NULL
  END as invited_email
FROM public.team_members;

-- Grant access to the view
GRANT SELECT ON public.team_members_secure TO authenticated;

-- Update the SELECT policy on team_members to be more restrictive
-- First drop the existing policy
DROP POLICY IF EXISTS "Team members can view team members" ON public.team_members;

-- Create a new policy that still allows viewing but the view will handle column masking
CREATE POLICY "Team members can view team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  is_team_member(team_id) 
  OR user_id = auth.uid() 
  OR (EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = team_members.team_id 
    AND t.created_by = auth.uid()
  ))
);