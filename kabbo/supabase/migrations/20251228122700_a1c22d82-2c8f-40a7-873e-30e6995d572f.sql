-- Create a function to link pending invitations when a user signs up
CREATE OR REPLACE FUNCTION public.link_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update any pending invitations that match the new user's email
  UPDATE public.publication_collaborators
  SET user_id = NEW.id
  WHERE invited_email = LOWER(NEW.email)
    AND user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run after profile is created (which happens after user signup)
DROP TRIGGER IF EXISTS on_profile_created_link_invitations ON public.profiles;
CREATE TRIGGER on_profile_created_link_invitations
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_pending_invitations();

-- Make user_id nullable in publication_collaborators for pending invitations to non-users
ALTER TABLE public.publication_collaborators
  ALTER COLUMN user_id DROP NOT NULL;