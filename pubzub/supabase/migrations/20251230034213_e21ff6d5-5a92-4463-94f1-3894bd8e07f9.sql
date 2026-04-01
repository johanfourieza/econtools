-- Drop the problematic policies causing infinite recursion
DROP POLICY IF EXISTS "Collaborators can view publications" ON public.publications;
DROP POLICY IF EXISTS "Deny anonymous access to publications" ON public.publications;

-- Recreate a simpler policy for owners (this already exists and works)
-- The "Owners can manage their publications" policy handles owner access

-- Create a separate, non-recursive policy for collaborator access
-- Instead of using a subquery to publication_collaborators, we'll use a security definer function

CREATE OR REPLACE FUNCTION public.user_is_collaborator(pub_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM publication_collaborators pc
    WHERE pc.publication_id = pub_id 
      AND pc.user_id = auth.uid() 
      AND pc.status = 'accepted'
  );
$$;

-- Create collaborator view policy using the function
CREATE POLICY "Collaborators can view publications"
ON public.publications
FOR SELECT
USING (
  auth.uid() = owner_id 
  OR public.user_is_collaborator(id)
);

-- Drop and recreate owner policy to avoid conflicts
DROP POLICY IF EXISTS "Owners can manage their publications" ON public.publications;

CREATE POLICY "Owners can manage their publications"
ON public.publications
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);