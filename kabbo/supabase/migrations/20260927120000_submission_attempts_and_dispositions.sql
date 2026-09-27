-- Proposal 4 (PROPOSALS-2026-09-27.txt): model the journey a paper actually
-- takes.
--
-- 1. submission_attempts: one row per journal a paper is sent to. A rejection
--    closes the attempt and leaves the paper where it is; the next attempt is
--    a new row. Replaces the single target_journal as the source of truth for
--    "where has this been", while target_journal keeps meaning "where is it
--    going next".
-- 2. dispositions on publications: paused / shelved with a reason and an
--    optional reconsider date, so a paper can rest deliberately instead of
--    rotting in Draft or being binned.

BEGIN;

CREATE TABLE IF NOT EXISTS public.submission_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal TEXT NOT NULL,
  submitted_at DATE NOT NULL DEFAULT CURRENT_DATE,
  manuscript_number TEXT,
  decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'desk_reject', 'reject', 'revise_resubmit', 'accept', 'withdrawn')),
  decision_at DATE,
  -- Number of revised versions sent back (0 = first submission only).
  rounds INTEGER NOT NULL DEFAULT 0 CHECK (rounds >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_attempts_publication_idx ON public.submission_attempts(publication_id);
CREATE INDEX IF NOT EXISTS submission_attempts_user_idx ON public.submission_attempts(user_id);

ALTER TABLE public.submission_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own submission attempts" ON public.submission_attempts;
CREATE POLICY "Users manage their own submission attempts"
  ON public.submission_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS disposition TEXT NOT NULL DEFAULT 'active'
    CHECK (disposition IN ('active', 'paused', 'shelved')),
  ADD COLUMN IF NOT EXISTS disposition_reason TEXT,
  ADD COLUMN IF NOT EXISTS disposition_reconsider_at DATE;

COMMIT;
