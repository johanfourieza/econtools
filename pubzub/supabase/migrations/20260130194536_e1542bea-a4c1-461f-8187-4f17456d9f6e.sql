-- Add dashboard_public column to teams table
-- When true, all team members can view the Dashboard
-- When false (default), only admins can view Dashboard
ALTER TABLE public.teams 
ADD COLUMN dashboard_public boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.teams.dashboard_public IS 'When true, all team members can view the Dashboard. Analytics remains admin-only.';