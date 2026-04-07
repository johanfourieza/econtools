-- Add explicit policies to deny anonymous access to publication_comments
-- This ensures that even if anonymous access is somehow enabled, comments remain protected

CREATE POLICY "Deny anonymous access to comments"
ON public.publication_comments
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anonymous insert to comments"
ON public.publication_comments
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Deny anonymous update to comments"
ON public.publication_comments
FOR UPDATE
TO anon
USING (false);

CREATE POLICY "Deny anonymous delete to comments"
ON public.publication_comments
FOR DELETE
TO anon
USING (false);