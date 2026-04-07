-- Fix: Restrict email visibility to prevent transitive exposure
-- Issue: profiles_email_broad_access - Users can see emails of indirect collaborators

-- Step 1: Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view collaborator profiles" ON public.profiles;

-- Step 2: Create a security definer function to check direct collaboration
-- This prevents infinite recursion and provides clean access control
CREATE OR REPLACE FUNCTION public.is_direct_collaborator(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if the profile belongs to someone on the same publication as current user
  SELECT EXISTS (
    SELECT 1
    FROM publication_collaborators my_collab
    JOIN publication_collaborators their_collab 
      ON their_collab.publication_id = my_collab.publication_id
    WHERE my_collab.user_id = auth.uid()
      AND my_collab.status = 'accepted'
      AND their_collab.user_id = _profile_id
      AND their_collab.status = 'accepted'
  )
  OR EXISTS (
    -- Publication owners can see their collaborators
    SELECT 1 
    FROM publications p
    JOIN publication_collaborators pc ON pc.publication_id = p.id
    WHERE p.owner_id = auth.uid()
      AND pc.user_id = _profile_id
  )
  OR EXISTS (
    -- Collaborators can see publication owners
    SELECT 1
    FROM publication_collaborators pc
    JOIN publications p ON p.id = pc.publication_id
    WHERE pc.user_id = auth.uid()
      AND pc.status = 'accepted'
      AND p.owner_id = _profile_id
  );
$$;

-- Step 3: Create a new restrictive policy for viewing collaborator profiles
-- This only allows viewing profiles of people on the SAME publication (not transitive)
CREATE POLICY "Users can view direct collaborator profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id  -- Always can view own profile
  OR public.is_direct_collaborator(id)
);

-- Step 4: Create a view for public profile data (excludes email)
-- This can be used when email is not needed
CREATE OR REPLACE VIEW public.profiles_public AS 
SELECT 
  id, 
  display_name, 
  avatar_url, 
  university_affiliation, 
  google_scholar_url, 
  personal_website_url, 
  orcid_id,
  created_at,
  updated_at
FROM public.profiles;