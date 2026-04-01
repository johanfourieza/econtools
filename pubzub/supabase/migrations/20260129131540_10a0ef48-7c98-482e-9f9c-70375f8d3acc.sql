-- Fix infinite recursion in team_members SELECT policy
-- The problem: The policy had a self-referential EXISTS subquery to team_members
-- Solution: Use the is_team_member() SECURITY DEFINER function which bypasses RLS

-- First, create a helper function that checks ANY membership (pending or accepted) 
-- This is needed because is_team_member only checks 'accepted' status
CREATE OR REPLACE FUNCTION public.has_any_team_membership(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = auth.uid()
  );
$$;

-- Drop and recreate the team_members SELECT policy
-- Use SECURITY DEFINER function instead of self-referential subquery
DROP POLICY IF EXISTS "Team members can view team members" ON public.team_members;

CREATE POLICY "Team members can view team members" 
ON public.team_members 
FOR SELECT 
USING (
  -- Users can see their own membership records (any status)
  user_id = auth.uid()
  -- Accepted team members can see other members (uses SECURITY DEFINER - no RLS recursion)
  OR is_team_member(team_id)
  -- Team creators can see all members
  OR team_id IN (SELECT id FROM public.teams WHERE created_by = auth.uid())
);