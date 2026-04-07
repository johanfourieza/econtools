-- Drop the overly permissive policy that exposes all profiles publicly
DROP POLICY IF EXISTS "Users can look up profiles by email for invites" ON public.profiles;

-- Create a secure policy that only allows publication owners to look up profiles by email
-- This is needed for the invite collaborator feature
CREATE POLICY "Publication owners can lookup profiles for invites"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR 
  (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.publications 
      WHERE owner_id = auth.uid()
    )
  )
);