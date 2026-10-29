-- ==============================================================================
-- Migration: 002_create_contracts_and_memberships.sql
-- Description: Projects/contracts and multi-tenant membership mapping
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  total_budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status contract_status NOT NULL DEFAULT 'draft',
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  freelancer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_contracts_client ON public.contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_freelancer ON public.contracts(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

DROP TRIGGER IF EXISTS set_contracts_updated_at ON public.contracts;
CREATE TRIGGER set_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Contract memberships table: defines who has access to view/collaborate on a contract
CREATE TABLE IF NOT EXISTS public.contract_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT unique_contract_member UNIQUE (contract_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_contract ON public.contract_memberships(contract_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.contract_memberships(user_id);
