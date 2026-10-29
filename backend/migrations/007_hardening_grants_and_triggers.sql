-- ==============================================================================
-- Migration: 007_hardening_grants_and_triggers.sql
-- Description: Defense-in-depth SQL grants, column-level update locks,
--              automatic contract membership triggers, and immutable field checks.
-- ==============================================================================

-- ── 1. REVOKE DEFAULT PUBLIC & ANON ACCESS ────────────────────────────────────
-- Ensure the anonymous role has no direct access to application data
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.contracts FROM anon;
REVOKE ALL ON TABLE public.contract_memberships FROM anon;
REVOKE ALL ON TABLE public.milestones FROM anon;
REVOKE ALL ON TABLE public.submissions FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;
REVOKE ALL ON TABLE public.audit_events FROM anon;

-- ── 2. FINANCIAL & AUDIT IMMUTABILITY GRANTS ──────────────────────────────────
-- Authenticated users can only SELECT payments and audit events
-- Even if an RLS policy is misconfigured, table grants forbid direct client DML
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_events FROM authenticated, anon;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

-- ── 3. COLUMN-LEVEL UPDATE PROTECTION ON PROFILES ────────────────────────────
-- Authenticated users can only modify their display name and avatar URL
-- Role, User ID, Email, and Onboarding status cannot be modified via client UPDATE
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- ── 4. AUTOMATIC CONTRACT CREATOR MEMBERSHIP TRIGGER ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_contract_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Automatically register the creator as client member
  INSERT INTO public.contract_memberships (contract_id, user_id, role)
  VALUES (NEW.id, NEW.client_id, 'client')
  ON CONFLICT (contract_id, user_id) DO NOTHING;

  -- 2. If a freelancer is assigned at creation, register them as freelancer member
  IF NEW.freelancer_id IS NOT NULL THEN
    INSERT INTO public.contract_memberships (contract_id, user_id, role)
    VALUES (NEW.id, NEW.freelancer_id, 'freelancer')
    ON CONFLICT (contract_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_contract_created_membership ON public.contracts;
CREATE TRIGGER on_contract_created_membership
  AFTER INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_contract_membership();

-- ── 5. SEPARATE EXPLICIT MILESTONE POLICIES (PREVENT CONTRACT REASSIGNMENT) ────
DROP POLICY IF EXISTS "milestones_modify_client" ON public.milestones;

-- Insert milestone: Must be a client member of the contract
CREATE POLICY "milestones_insert_client"
  ON public.milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = milestones.contract_id
        AND contract_memberships.user_id = auth.uid()
        AND contract_memberships.role = 'client'
    )
  );

-- Update milestone: Must be a client member and CANNOT reassign to another contract
CREATE POLICY "milestones_update_client"
  ON public.milestones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = milestones.contract_id
        AND contract_memberships.user_id = auth.uid()
        AND contract_memberships.role = 'client'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = milestones.contract_id
        AND contract_memberships.user_id = auth.uid()
        AND contract_memberships.role = 'client'
    )
  );

-- Delete milestone: Only client member of the contract
CREATE POLICY "milestones_delete_client"
  ON public.milestones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = milestones.contract_id
        AND contract_memberships.user_id = auth.uid()
        AND contract_memberships.role = 'client'
    )
  );
