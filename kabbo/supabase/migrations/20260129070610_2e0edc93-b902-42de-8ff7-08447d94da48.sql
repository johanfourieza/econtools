-- Add dashboard access column to team_members
ALTER TABLE public.team_members
ADD COLUMN has_dashboard_access boolean NOT NULL DEFAULT false;

-- Create function to check dashboard access
CREATE OR REPLACE FUNCTION public.has_dashboard_access(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = auth.uid()
      AND status = 'accepted'
      AND (role = 'admin' OR has_dashboard_access = true)
  )
  OR EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND created_by = auth.uid()
  );
$$;