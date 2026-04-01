-- Fix infinite recursion between teams and team_members RLS policies
-- The problem: team_members SELECT policy calls is_team_member() AND queries teams table
-- teams SELECT policy queries team_members table -> circular dependency

-- STEP 1: Fix team_members SELECT policy to NOT use is_team_member() or reference teams
DROP POLICY IF EXISTS "Team members can view team members" ON public.team_members;

CREATE POLICY "Team members can view team members" 
ON public.team_members 
FOR SELECT 
USING (
  -- Users can always see their own membership records
  user_id = auth.uid()
  -- Users can see other members in teams they belong to (direct check, no function)
  OR EXISTS (
    SELECT 1 FROM public.team_members my_membership
    WHERE my_membership.team_id = team_members.team_id
    AND my_membership.user_id = auth.uid()
    AND my_membership.status = 'accepted'
  )
);

-- STEP 2: Fix teams SELECT policy with correct column reference
DROP POLICY IF EXISTS "Team members and invitees can view teams" ON public.teams;

CREATE POLICY "Team members and invitees can view teams" 
ON public.teams 
FOR SELECT 
USING (
  -- Team creator can always see
  created_by = auth.uid()
  -- Accepted team members can see
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id
    AND tm.user_id = auth.uid()
    AND tm.status = 'accepted'
  )
  -- Pending invitees can see their invited team
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id
    AND tm.user_id = auth.uid()
    AND tm.status = 'pending'
  )
);

-- STEP 3: Fix team_members INSERT policy to not use is_team_admin (avoid potential recursion)
DROP POLICY IF EXISTS "Team admins can add members" ON public.team_members;

CREATE POLICY "Team admins can add members" 
ON public.team_members 
FOR INSERT 
WITH CHECK (
  -- Team creator can add members
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.created_by = auth.uid()
  )
  -- Existing admins can add members (direct check)
  OR EXISTS (
    SELECT 1 FROM public.team_members existing
    WHERE existing.team_id = team_members.team_id
    AND existing.user_id = auth.uid()
    AND existing.role::text = 'admin'
    AND existing.status = 'accepted'
  )
);

-- STEP 4: Fix team_members UPDATE policy
DROP POLICY IF EXISTS "Team admins can update memberships" ON public.team_members;

CREATE POLICY "Team admins can update memberships" 
ON public.team_members 
FOR UPDATE 
USING (
  -- Team creator can update
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.created_by = auth.uid()
  )
  -- Existing admins can update (direct check)
  OR EXISTS (
    SELECT 1 FROM public.team_members existing
    WHERE existing.team_id = team_members.team_id
    AND existing.user_id = auth.uid()
    AND existing.role::text = 'admin'
    AND existing.status = 'accepted'
  )
);

-- STEP 5: Fix team_members DELETE policy
DROP POLICY IF EXISTS "Team admins can remove members" ON public.team_members;

CREATE POLICY "Team admins can remove members" 
ON public.team_members 
FOR DELETE 
USING (
  -- Users can remove themselves
  user_id = auth.uid()
  -- Team creator can remove
  OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
    AND t.created_by = auth.uid()
  )
  -- Existing admins can remove (direct check)
  OR EXISTS (
    SELECT 1 FROM public.team_members existing
    WHERE existing.team_id = team_members.team_id
    AND existing.user_id = auth.uid()
    AND existing.role::text = 'admin'
    AND existing.status = 'accepted'
  )
);