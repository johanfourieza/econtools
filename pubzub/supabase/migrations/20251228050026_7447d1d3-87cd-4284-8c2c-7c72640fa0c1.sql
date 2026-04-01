-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Publications table
CREATE TABLE public.publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  authors TEXT[] DEFAULT '{}',
  stage TEXT NOT NULL DEFAULT 'idea',
  target_year INTEGER,
  themes TEXT[] DEFAULT '{}',
  grants TEXT[] DEFAULT '{}',
  output_type TEXT DEFAULT 'journal-article',
  notes TEXT DEFAULT '',
  links TEXT[] DEFAULT '{}',
  github_repo TEXT,
  overleaf_link TEXT,
  data_sources TEXT[] DEFAULT '{}',
  related_papers TEXT[] DEFAULT '{}',
  working_paper JSONB DEFAULT '{"isWorkingPaper": false}',
  stage_history JSONB[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Owners can manage their publications"
ON public.publications FOR ALL
USING (auth.uid() = owner_id);

-- Collaborators table
CREATE TABLE public.publication_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(publication_id, user_id)
);

ALTER TABLE public.publication_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner of publication can manage collaborators
CREATE POLICY "Publication owners can manage collaborators"
ON public.publication_collaborators FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.publications p
    WHERE p.id = publication_id AND p.owner_id = auth.uid()
  )
);

-- Collaborators can view their own invitations
CREATE POLICY "Users can view their collaborations"
ON public.publication_collaborators FOR SELECT
USING (user_id = auth.uid());

-- Collaborators can update their own status (accept/decline)
CREATE POLICY "Users can update their collaboration status"
ON public.publication_collaborators FOR UPDATE
USING (user_id = auth.uid());

-- Allow collaborators to access publications they're invited to
CREATE POLICY "Collaborators can view publications"
ON public.publications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.publication_collaborators pc
    WHERE pc.publication_id = id 
    AND pc.user_id = auth.uid() 
    AND pc.status = 'accepted'
  )
);

CREATE POLICY "Collaborators with editor role can update"
ON public.publications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.publication_collaborators pc
    WHERE pc.publication_id = id 
    AND pc.user_id = auth.uid() 
    AND pc.status = 'accepted'
    AND pc.role = 'editor'
  )
);

-- Reminders table
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID REFERENCES public.publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'general' CHECK (reminder_type IN ('deadline', 'conference', 'resubmission', 'working_paper', 'general')),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their reminders"
ON public.reminders FOR ALL
USING (auth.uid() = user_id);

-- Bin table for soft deletes
CREATE TABLE public.publication_bin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publication_data JSONB NOT NULL,
  original_stage TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.publication_bin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their bin"
ON public.publication_bin FOR ALL
USING (auth.uid() = user_id);

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_publications_updated_at
  BEFORE UPDATE ON public.publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();