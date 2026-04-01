-- Create enum for team roles
CREATE TYPE public.team_role AS ENUM ('admin', 'member');

-- Create enum for stage visibility
CREATE TYPE public.pipeline_stage AS ENUM ('idea', 'draft', 'submitted', 'revise_resubmit', 'resubmitted', 'accepted', 'published');

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id),
  UNIQUE(team_id, invited_email)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VISIBILITY SETTINGS TABLE
-- ============================================
CREATE TABLE public.visibility_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  min_visible_stage pipeline_stage NOT NULL DEFAULT 'idea',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Enable RLS
ALTER TABLE public.visibility_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Check if user is a member of a team (any status)
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id UUID)
RETURNS BOOLEAN
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
  );
$$;

-- Check if user is an admin of a team
CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id UUID)
RETURNS BOOLEAN
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
      AND role = 'admin'
      AND status = 'accepted'
  );
$$;

-- Get numeric index for stage comparison
CREATE OR REPLACE FUNCTION public.get_stage_index(_stage TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _stage
    WHEN 'idea' THEN 0
    WHEN 'draft' THEN 1
    WHEN 'submitted' THEN 2
    WHEN 'revise_resubmit' THEN 3
    WHEN 'resubmitted' THEN 4
    WHEN 'accepted' THEN 5
    WHEN 'published' THEN 6
    ELSE 0
  END;
$$;

-- ============================================
-- RLS POLICIES FOR TEAMS
-- ============================================

-- Team members can view their teams
CREATE POLICY "Team members can view their teams"
ON public.teams FOR SELECT
USING (public.is_team_member(id) OR created_by = auth.uid());

-- Users can create teams
CREATE POLICY "Authenticated users can create teams"
ON public.teams FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Team admins can update their teams
CREATE POLICY "Team admins can update teams"
ON public.teams FOR UPDATE
USING (public.is_team_admin(id) OR created_by = auth.uid());

-- Team creator can delete the team
CREATE POLICY "Team creator can delete teams"
ON public.teams FOR DELETE
USING (created_by = auth.uid());

-- ============================================
-- RLS POLICIES FOR TEAM MEMBERS
-- ============================================

-- Team members can view other members in their teams
CREATE POLICY "Team members can view team members"
ON public.team_members FOR SELECT
USING (
  public.is_team_member(team_id) 
  OR user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()
  )
);

-- Team admins can add members
CREATE POLICY "Team admins can add members"
ON public.team_members FOR INSERT
WITH CHECK (
  public.is_team_admin(team_id) 
  OR EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()
  )
);

-- Users can update their own membership (accept/decline)
CREATE POLICY "Users can update their membership"
ON public.team_members FOR UPDATE
USING (user_id = auth.uid());

-- Team admins can update any membership
CREATE POLICY "Team admins can update memberships"
ON public.team_members FOR UPDATE
USING (
  public.is_team_admin(team_id)
  OR EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()
  )
);

-- Team admins can remove members
CREATE POLICY "Team admins can remove members"
ON public.team_members FOR DELETE
USING (
  public.is_team_admin(team_id)
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.created_by = auth.uid()
  )
);

-- ============================================
-- RLS POLICIES FOR VISIBILITY SETTINGS
-- ============================================

-- Users can view visibility settings for teams they belong to
CREATE POLICY "Team members can view visibility settings"
ON public.visibility_settings FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_team_member(team_id)
);

-- Users can manage their own visibility settings
CREATE POLICY "Users can insert their visibility settings"
ON public.visibility_settings FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their visibility settings"
ON public.visibility_settings FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their visibility settings"
ON public.visibility_settings FOR DELETE
USING (user_id = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_status ON public.team_members(status);
CREATE INDEX idx_visibility_settings_team_id ON public.visibility_settings(team_id);
CREATE INDEX idx_visibility_settings_user_id ON public.visibility_settings(user_id);

-- ============================================
-- TRIGGER: Auto-create team member for creator
-- ============================================

CREATE OR REPLACE FUNCTION public.auto_add_team_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'accepted');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_team_creator();

-- ============================================
-- TRIGGER: Link pending invitations when user signs up
-- ============================================

CREATE OR REPLACE FUNCTION public.link_pending_team_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_members
  SET user_id = NEW.id
  WHERE invited_email = LOWER(NEW.email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_link_team_invitations
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_pending_team_invitations();

-- ============================================
-- TRIGGER: Update visibility_settings updated_at
-- ============================================

CREATE TRIGGER update_visibility_settings_updated_at
  BEFORE UPDATE ON public.visibility_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();