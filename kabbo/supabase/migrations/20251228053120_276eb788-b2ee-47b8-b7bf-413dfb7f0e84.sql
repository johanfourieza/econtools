-- Allow authenticated users to look up other profiles by email for collaboration invites
CREATE POLICY "Users can look up profiles by email for invites"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);