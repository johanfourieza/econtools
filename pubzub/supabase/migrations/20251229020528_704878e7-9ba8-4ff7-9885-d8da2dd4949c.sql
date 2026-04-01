-- Create publication_comments table for co-author chat
CREATE TABLE public.publication_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.publication_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Publication owners can manage all comments on their publications
CREATE POLICY "Publication owners can manage comments"
ON public.publication_comments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.publications p
    WHERE p.id = publication_comments.publication_id
    AND p.owner_id = auth.uid()
  )
);

-- Policy: Accepted collaborators can view comments
CREATE POLICY "Collaborators can view comments"
ON public.publication_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.publication_collaborators pc
    WHERE pc.publication_id = publication_comments.publication_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- Policy: Accepted collaborators can insert their own comments
CREATE POLICY "Collaborators can add comments"
ON public.publication_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.publication_collaborators pc
    WHERE pc.publication_id = publication_comments.publication_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.publication_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_publication_comments_publication_id ON public.publication_comments(publication_id);
CREATE INDEX idx_publication_comments_created_at ON public.publication_comments(created_at);

-- Enable realtime for both publications and comments tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.publications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publication_comments;