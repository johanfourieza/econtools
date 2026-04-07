
-- Activity log for tracking automated updates via API, webhook, MCP
CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  source text NOT NULL, -- 'api', 'webhook', 'mcp'
  action text NOT NULL, -- 'created', 'updated', 'deleted', 'stage_changed', 'listed'
  publication_id uuid,
  publication_title text,
  details jsonb DEFAULT '{}'::jsonb,
  pubzub_yaml_detected boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own activity
CREATE POLICY "Users can view their own activity"
ON public.activity_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role inserts (edge functions use service role)
-- No insert policy needed for authenticated users since edge functions use service role key
