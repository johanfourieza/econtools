-- FINAL FIX: Remove ALL cross-table references to break the recursion chain completely
-- Strategy: 
-- 1. teams policy: ONLY use SECURITY DEFINER functions (no direct team_members subquery)
-- 2. team_members policy: ONLY use SECURITY DEFINER functions (no direct teams subquery)

-- Create a function to check if user is team creator (avoids querying teams from team_members policy)
CREATE OR REPLACE FUNCTION public.is_team_creator(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND created_by = auth.uid()
  );
$$;

-- Fix team_members SELECT policy - use ONLY SECURITY DEFINER functions
DROP POLICY IF EXISTS "Team members can view team members" ON public.team_members;

CREATE POLICY "Team members can view team members" 
ON public.team_members 
FOR SELECT 
USING (
  -- Users can see their own membership records
  user_id = auth.uid()
  -- Accepted team members can see other members
  OR is_team_member(team_id)
  -- Team creators can see all members (using SECURITY DEFINER function)
  OR is_team_creator(team_id)
);

-- Fix team_members INSERT policy - use ONLY SECURITY DEFINER functions  
DROP POLICY IF EXISTS "Team admins can add members" ON public.team_members;

CREATE POLICY "Team admins can add members" 
ON public.team_members 
FOR INSERT 
WITH CHECK (
  is_team_creator(team_id)
  OR is_team_admin(team_id)
);

-- Fix team_members UPDATE policies - use ONLY SECURITY DEFINER functions
DROP POLICY IF EXISTS "Team admins can update memberships" ON public.team_members;
DROP POLICY IF EXISTS "Users can update their membership" ON public.team_members;

CREATE POLICY "Team admins can update memberships" 
ON public.team_members 
FOR UPDATE 
USING (
  is_team_creator(team_id)
  OR is_team_admin(team_id)
  OR user_id = auth.uid()
);

-- Fix team_members DELETE policy - use ONLY SECURITY DEFINER functions
DROP POLICY IF EXISTS "Team admins can remove members" ON public.team_members;

CREATE POLICY "Team admins can remove members" 
ON public.team_members 
FOR DELETE 
USING (
  user_id = auth.uid()
  OR is_team_creator(team_id)
  OR is_team_admin(team_id)
);

-- Fix teams SELECT policy - use ONLY SECURITY DEFINER functions
DROP POLICY IF EXISTS "Team members and invitees can view teams" ON public.teams;

CREATE POLICY "Team members and invitees can view teams" 
ON public.teams 
FOR SELECT 
USING (
  created_by = auth.uid()
  OR is_team_member(id)
  OR has_any_team_membership(id)
);