-- Deny anonymous/public access to publications table
CREATE POLICY "Deny anonymous access to publications"
ON public.publications
FOR SELECT
TO anon
USING (false);