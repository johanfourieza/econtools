
-- Create a secure function to get pending invitations for the current user
-- This bypasses RLS issues where pending collaborators can't see publication titles
CREATE OR REPLACE FUNCTION public.get_pending_invitations()
RETURNS TABLE (
  id uuid,
  publication_id uuid,
  publication_title text,
  owner_id uuid,
  owner_name text,
  role text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pc.id,
    pc.publication_id,
    COALESCE(p.title, 'Untitled') as publication_title,
    p.owner_id,
    COALESCE(prof.display_name, 'Unknown') as owner_name,
    pc.role,
    pc.created_at
  FROM public.publication_collaborators pc
  JOIN public.publications p ON p.id = pc.publication_id
  LEFT JOIN public.profiles prof ON prof.id = p.owner_id
  WHERE pc.user_id = auth.uid()
    AND pc.status = 'pending';
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_pending_invitations() TO authenticated;
