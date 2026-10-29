-- ==============================================================================
-- Migration: 008_runtime_enhancements.sql
-- Description: Runtime enhancements for MilestoneShield AI:
--              1. Milestone acceptance criteria array column
--              2. Payment gateway references (approve_url, note)
--              3. Safe auto-status transition trigger on submissions
--              4. Concurrency-safe payment transition RPC (FOR UPDATE lock)
--              5. Grants & search_path security on all new objects
-- ==============================================================================

-- 1. Ensure acceptance_criteria column exists on public.milestones
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT[] NOT NULL DEFAULT '{}';

-- 2. Ensure payment references exist on public.payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approve_url TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- 3. Extend payment lifecycle enum if needed
DO $$ BEGIN
  ALTER TYPE payment_lifecycle_status ADD VALUE IF NOT EXISTS 'failed';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Trigger to automatically transition milestone status to 'submitted'
--    when a freelancer inserts a new deliverable submission
CREATE OR REPLACE FUNCTION public.handle_submission_milestone_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.milestones
  SET
    status = 'submitted',
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = NEW.milestone_id
    AND status IN ('pending', 'in_progress');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_updates_milestone ON public.submissions;
CREATE TRIGGER trg_submission_updates_milestone
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_submission_milestone_status();

-- 5. Atomic, concurrency-safe payment state transition stored procedure
--    Locks row with SELECT ... FOR UPDATE to eliminate race conditions
CREATE OR REPLACE FUNCTION public.record_payment_transition(
  p_payment_id UUID,
  p_new_status payment_lifecycle_status,
  p_actor_id UUID,
  p_actor_role VARCHAR,
  p_action VARCHAR,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_operator_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id UUID;
  v_curr_status payment_lifecycle_status;
BEGIN
  -- Row-level lock to prevent concurrent double-capture or void races
  SELECT contract_id, status INTO v_contract_id, v_curr_status
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record % not found', p_payment_id;
  END IF;

  -- Validate allowed lifecycle state progression
  IF v_curr_status = 'captured' AND p_new_status = 'captured' THEN
    RAISE EXCEPTION 'Payment % is already captured. Duplicate capture rejected.', p_payment_id;
  END IF;

  IF v_curr_status = 'voided' AND p_new_status = 'captured' THEN
    RAISE EXCEPTION 'Payment % is voided and cannot be captured.', p_payment_id;
  END IF;

  -- Update payment state
  UPDATE public.payments
  SET
    status = p_new_status,
    operator_notes = COALESCE(p_operator_notes, operator_notes),
    authorized_at = CASE WHEN p_new_status = 'authorized' AND authorized_at IS NULL THEN TIMEZONE('utc', NOW()) ELSE authorized_at END,
    captured_at = CASE WHEN p_new_status = 'captured' AND captured_at IS NULL THEN TIMEZONE('utc', NOW()) ELSE captured_at END,
    voided_at = CASE WHEN p_new_status = 'voided' AND voided_at IS NULL THEN TIMEZONE('utc', NOW()) ELSE voided_at END,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_payment_id;

  -- Append to immutable audit trail
  INSERT INTO public.audit_events (
    entity_type,
    entity_id,
    action,
    actor_id,
    actor_role,
    payload
  ) VALUES (
    'payment',
    p_payment_id::text,
    p_action,
    p_actor_id,
    p_actor_role,
    p_payload
  );
END;
$$;

-- Narrowly grant execute to service role; revoke from anon and authenticated
REVOKE ALL ON FUNCTION public.record_payment_transition FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.record_payment_transition TO service_role;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;
