-- Drop the overly permissive policy that allows viewing ALL profiles
DROP POLICY IF EXISTS "Publication owners can lookup profiles for invites" ON public.profiles;

-- Create a restrictive policy that only allows viewing profiles of actual collaborators
-- Users can view:
-- 1. Their own profile (covered by existing policy "Users can view their own profile")
-- 2. Profiles of collaborators on publications they own
-- 3. Profiles of owners/collaborators on publications they collaborate on

CREATE POLICY "Users can view collaborator profiles"
ON public.profiles
FOR SELECT
USING (
  -- Own profile is already covered by "Users can view their own profile"
  -- This policy covers viewing OTHER users' profiles only when there's a collaboration relationship
  
  -- Case 1: I own a publication and this profile belongs to someone collaborating on it
  EXISTS (
    SELECT 1 
    FROM public.publications p
    JOIN public.publication_collaborators pc ON pc.publication_id = p.id
    WHERE p.owner_id = auth.uid() 
      AND pc.user_id = profiles.id
  )
  OR
  -- Case 2: I'm a collaborator and this profile is the publication owner
  EXISTS (
    SELECT 1
    FROM public.publication_collaborators pc
    JOIN public.publications p ON p.id = pc.publication_id
    WHERE pc.user_id = auth.uid()
      AND pc.status = 'accepted'
      AND p.owner_id = profiles.id
  )
  OR
  -- Case 3: I'm a collaborator and this profile is another collaborator on the same publication
  EXISTS (
    SELECT 1
    FROM public.publication_collaborators my_collab
    JOIN public.publication_collaborators their_collab ON their_collab.publication_id = my_collab.publication_id
    WHERE my_collab.user_id = auth.uid()
      AND my_collab.status = 'accepted'
      AND their_collab.user_id = profiles.id
  )
);