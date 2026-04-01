-- Fix infinite recursion in teams RLS policy
-- The issue: teams policy calls is_team_member() which queries team_members,
-- and team_members policy references teams, creating a circular dependency.

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members and invitees can view teams" ON public.teams;

-- Create a new policy that uses direct subqueries instead of calling is_team_member()
-- This avoids the recursive call chain
CREATE POLICY "Team members and invitees can view teams" 
ON public.teams 
FOR SELECT 
USING (
  -- Team creator can always see
  created_by = auth.uid()
  -- Accepted team members can see (direct query, no function call)
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = id
    AND tm.user_id = auth.uid()
    AND tm.status = 'accepted'
  )
  -- Pending invitees can see their invited team
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = id
    AND tm.user_id = auth.uid()
    AND tm.status = 'pending'
  )
);

-- For the team_members_secure view: it was created with security_invoker=on
-- which means it inherits RLS from the base team_members table.
-- However, the security scanner flags views without explicit policies.
-- We need to ensure the view is secure by:
-- 1. Confirming security_invoker is on (done in previous migration)
-- 2. Adding a comment to document this is intentional
COMMENT ON VIEW public.team_members_secure IS 
  'Secure view of team_members that hides invited_email from non-admins. Uses security_invoker=on to inherit RLS from base table.';