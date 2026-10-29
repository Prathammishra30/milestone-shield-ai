-- ==============================================================================
-- Migration: 009_webhook_events.sql
-- Description: Idempotent PayPal webhook event tracking table.
--              Prevents duplicate event processing and records processing status.
-- ==============================================================================

-- Webhook processing status enum
DO $$ BEGIN
  CREATE TYPE webhook_event_status AS ENUM (
    'received',
    'processed',
    'ignored',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- PayPal event ID (the event's own ID, used for deduplication)
  paypal_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  -- Processing status
  status webhook_event_status NOT NULL DEFAULT 'received',
  -- Associated payment record (nullable; may not exist for all event types)
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  -- Denormalized resource identifiers for lookups
  paypal_order_id TEXT,
  paypal_authorization_id TEXT,
  paypal_capture_id TEXT,
  -- Processing metadata
  processing_notes TEXT,
  error_message TEXT,
  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Unique constraint on PayPal event ID for idempotent processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_paypal_event_id
  ON public.webhook_events(paypal_event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type
  ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment
  ON public.webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received
  ON public.webhook_events(received_at);

-- RLS: Enable, but no client access — webhook events are server-internal
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Admins can view webhook events for debugging
CREATE POLICY "webhook_events_select_admin"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Prevent any client INSERT/UPDATE/DELETE
CREATE POLICY "webhook_events_prevent_client_insert"
  ON public.webhook_events
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "webhook_events_prevent_client_update"
  ON public.webhook_events
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "webhook_events_prevent_client_delete"
  ON public.webhook_events
  FOR DELETE
  TO authenticated
  USING (false);

-- Revoke direct DML from authenticated and anon roles
REVOKE INSERT, UPDATE, DELETE ON public.webhook_events FROM authenticated, anon;
GRANT SELECT ON public.webhook_events TO authenticated;

-- Revoke all from anon
REVOKE ALL ON public.webhook_events FROM anon;
