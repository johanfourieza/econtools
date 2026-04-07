-- Create storage bucket for paper uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', false);

-- Allow authenticated users to upload their own papers
CREATE POLICY "Users can upload papers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'papers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own papers
CREATE POLICY "Users can view their own papers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'papers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own papers
CREATE POLICY "Users can delete their own papers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'papers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own papers
CREATE POLICY "Users can update their own papers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'papers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add paper_file_path column to publications table to store the file reference
ALTER TABLE public.publications
ADD COLUMN paper_file_path TEXT DEFAULT NULL;