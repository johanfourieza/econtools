-- Create a secure function to find a user ID by email
-- This allows looking up users for invitations without exposing emails
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE LOWER(u.email) = LOWER(_email)
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated;

-- Revoke from anon to prevent unauthenticated access
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM anon;

-- Create a function to check if an email matches the current user
CREATE OR REPLACE FUNCTION public.is_current_user_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND LOWER(u.email) = LOWER(_email)
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_current_user_email(text) TO authenticated;

-- Revoke from anon
REVOKE EXECUTE ON FUNCTION public.is_current_user_email(text) FROM anon;

-- Update the link_pending_invitations trigger to use auth.users email
CREATE OR REPLACE FUNCTION public.link_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get email from auth.users table
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;
  
  -- Update any pending invitations that match the new user's email
  UPDATE public.publication_collaborators
  SET user_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Update the link_pending_team_invitations trigger similarly
CREATE OR REPLACE FUNCTION public.link_pending_team_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get email from auth.users table
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;
  
  UPDATE public.team_members
  SET user_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;