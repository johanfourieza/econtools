-- PERMANENT FIX: Drop the profiles_public view entirely
-- This view is not used anywhere in the application code
-- and causes security warnings about public data exposure.
-- The profiles table with proper RLS policies should be used directly.

DROP VIEW IF EXISTS public.profiles_public;