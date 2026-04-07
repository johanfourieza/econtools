-- Fix the broken RLS policies for collaborators viewing/editing publications
DROP POLICY IF EXISTS "Collaborators can view publications" ON public.publications;
DROP POLICY IF EXISTS "Collaborators with editor role can update" ON public.publications;

-- Correct policy: Collaborators can view publications they're invited to
CREATE POLICY "Collaborators can view publications" 
ON public.publications 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM publication_collaborators pc
    WHERE pc.publication_id = publications.id 
    AND pc.user_id = auth.uid() 
    AND pc.status = 'accepted'
  )
);

-- Correct policy: Collaborators with editor role can update
CREATE POLICY "Collaborators with editor role can update" 
ON public.publications 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM publication_collaborators pc
    WHERE pc.publication_id = publications.id 
    AND pc.user_id = auth.uid() 
    AND pc.status = 'accepted' 
    AND pc.role = 'editor'
  )
);