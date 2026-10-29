-- ==============================================================================
-- Migration: 004_create_payments_and_audit.sql
-- Description: Financial payment records and tamper-evident audit log
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE payment_lifecycle_status AS ENUM (
    'unfunded',
    'created',
    'authorized',
    'captured',
    'voided',
    'refunded'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payments table
-- Note: ON DELETE RESTRICT ensures financial records cannot be accidentally deleted.
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status payment_lifecycle_status NOT NULL DEFAULT 'unfunded',

  -- PayPal gateway references
  paypal_order_id TEXT,
  paypal_authorization_id TEXT,
  paypal_capture_id TEXT,
  paypal_debug_id TEXT,
  idempotency_key TEXT,

  -- State transition timestamps
  authorized_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,

  operator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT unique_paypal_order UNIQUE (paypal_order_id),
  CONSTRAINT unique_paypal_auth UNIQUE (paypal_authorization_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_milestone ON public.payments(milestone_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract ON public.payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_auth ON public.payments(paypal_authorization_id);

DROP TRIGGER IF EXISTS set_payments_updated_at ON public.payments;
CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Immutable Audit Events table
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role VARCHAR(32),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_events(created_at);

-- Prevent any modification or deletion of audit events
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit event records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.audit_events;
CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_tampering();
