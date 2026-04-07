-- Fix: Remove SECURITY DEFINER view (it defaults to SECURITY DEFINER which is unsafe)
-- Replace with SECURITY INVOKER view so RLS policies are enforced for the querying user

DROP VIEW IF EXISTS public.profiles_public;

-- Recreate view with SECURITY INVOKER (the safe option)
CREATE VIEW public.profiles_public 
WITH (security_invoker = true)
AS 
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