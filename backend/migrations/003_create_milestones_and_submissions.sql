-- ==============================================================================
-- Migration: 003_create_milestones_and_submissions.sql
-- Description: Milestones, acceptance criteria, and deliverable submissions
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM (
    'pending',
    'in_progress',
    'submitted',
    'approved',
    'paid',
    'disputed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM (
    'pending_review',
    'revision_requested',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status milestone_status NOT NULL DEFAULT 'pending',
  order_index INTEGER NOT NULL DEFAULT 1,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_milestones_contract ON public.milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON public.milestones(status);

DROP TRIGGER IF EXISTS set_milestones_updated_at ON public.milestones;
CREATE TRIGGER set_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Submissions table for deliverable proof
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  deliverable_url TEXT NOT NULL,
  notes TEXT,
  status submission_status NOT NULL DEFAULT 'pending_review',
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_submissions_milestone ON public.submissions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contract ON public.submissions(contract_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter ON public.submissions(submitted_by);

DROP TRIGGER IF EXISTS set_submissions_updated_at ON public.submissions;
CREATE TRIGGER set_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
