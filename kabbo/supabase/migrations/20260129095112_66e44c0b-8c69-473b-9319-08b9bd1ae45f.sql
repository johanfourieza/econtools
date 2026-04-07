-- Create storage policies for the papers bucket
-- Allow publication owners to upload papers to their publications folder
CREATE POLICY "Publication owners can upload papers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'papers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow publication owners to update their papers
CREATE POLICY "Publication owners can update papers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'papers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow publication owners to delete their papers
CREATE POLICY "Publication owners can delete papers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'papers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow publication owners to view their own papers
CREATE POLICY "Publication owners can view their papers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'papers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow collaborators to view papers for publications they collaborate on
-- The file path format is: {owner_id}/{publication_id}/{filename}
CREATE POLICY "Collaborators can view publication papers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'papers' 
  AND EXISTS (
    SELECT 1 
    FROM public.publications p
    JOIN public.publication_collaborators pc ON pc.publication_id = p.id
    WHERE p.owner_id::text = (storage.foldername(name))[1]
      AND p.paper_file_path LIKE '%' || name
      AND pc.user_id = auth.uid()
      AND pc.status = 'accepted'
  )
);