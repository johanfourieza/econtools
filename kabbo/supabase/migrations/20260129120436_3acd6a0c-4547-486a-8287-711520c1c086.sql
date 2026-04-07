-- Add logo_url column to teams table
ALTER TABLE public.teams ADD COLUMN logo_url text;

-- Create storage bucket for team logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for team-logos bucket
-- Team admins can upload logos for their teams
CREATE POLICY "Team admins can upload team logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND public.is_team_admin((storage.foldername(name))[1]::uuid)
);

-- Team admins can update team logos
CREATE POLICY "Team admins can update team logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND public.is_team_admin((storage.foldername(name))[1]::uuid)
);

-- Team admins can delete team logos
CREATE POLICY "Team admins can delete team logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND public.is_team_admin((storage.foldername(name))[1]::uuid)
);

-- Anyone can view team logos (public bucket)
CREATE POLICY "Anyone can view team logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'team-logos');