-- Add CHECK constraint to publication_comments for content length validation
-- This prevents users from submitting empty or extremely long comments (max 5000 chars)
ALTER TABLE public.publication_comments 
ADD CONSTRAINT content_length_check 
CHECK (length(content) > 0 AND length(content) <= 5000);