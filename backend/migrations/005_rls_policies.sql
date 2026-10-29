-- ==============================================================================
-- Migration: 005_rls_policies.sql
-- Description: Explicit Row-Level Security (RLS) policies for multi-tenant isolation
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- ── 2. PROFILES POLICIES ───────────────────────────────────────────────────

-- Users can read their own profile, or profiles of collaborators in their contracts
CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    id IN (
      SELECT cm2.user_id
      FROM public.contract_memberships cm1
      JOIN public.contract_memberships cm2 ON cm1.contract_id = cm2.contract_id
      WHERE cm1.user_id = auth.uid()
    )
  );

-- Users can update only their own profile, and cannot escalate themselves to admin
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- ── 3. CONTRACTS POLICIES ──────────────────────────────────────────────────

-- Users can only read contracts they are a member of or party to (client/freelancer)
CREATE POLICY "contracts_select_member"
  ON public.contracts
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR
    freelancer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = contracts.id
        AND contract_memberships.user_id = auth.uid()
    )
  );

-- Only clients can create new contracts where they are client_id
CREATE POLICY "contracts_insert_client"
  ON public.contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

-- Only contract owner (client_id) can update draft/active contract details
CREATE POLICY "contracts_update_client"
  ON public.contracts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- ── 4. CONTRACT MEMBERSHIPS POLICIES ───────────────────────────────────────

-- Members can see other memberships in their contracts
CREATE POLICY "memberships_select_member"
  ON public.contract_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    contract_id IN (
      SELECT contract_id FROM public.contract_memberships WHERE user_id = auth.uid()
    )
  );

-- ── 5. MILESTONES POLICIES ─────────────────────────────────────────────────

-- Members of the contract can view its milestones
CREATE POLICY "milestones_select_member"
  ON public.milestones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = milestones.contract_id
        AND contract_memberships.user_id = auth.uid()
    )
  );

-- Only client members can create/edit milestone budget specifications
CREATE POLICY "milestones_modify_client"
  ON public.milestones
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = milestones.contract_id
        AND contract_memberships.user_id = auth.uid()
        AND contract_memberships.role = 'client'
    )
  );

-- ── 6. SUBMISSIONS POLICIES ────────────────────────────────────────────────

-- Contract members can view submissions
CREATE POLICY "submissions_select_member"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = submissions.contract_id
        AND contract_memberships.user_id = auth.uid()
    )
  );

-- Freelancer members can create submissions for their assigned milestones
CREATE POLICY "submissions_insert_freelancer"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = submitted_by AND
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = submissions.contract_id
        AND contract_memberships.user_id = auth.uid()
        AND contract_memberships.role = 'freelancer'
    )
  );

-- ── 7. PAYMENTS POLICIES (STRICT FINANCIAL INTEGRITY) ───────────────────────

-- Contract members can VIEW payment records for transparency
CREATE POLICY "payments_select_member"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_memberships
      WHERE contract_memberships.contract_id = payments.contract_id
        AND contract_memberships.user_id = auth.uid()
    )
  );

-- Direct client INSERTs are strictly FORBIDDEN.
-- Payments can only be initiated by the authorized Express backend using service role.
CREATE POLICY "payments_prevent_client_insert"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Direct client UPDATEs are strictly FORBIDDEN.
-- Users cannot edit amounts or mark payments captured via direct Supabase client calls.
CREATE POLICY "payments_prevent_client_update"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (false);

-- Direct client DELETEs are strictly FORBIDDEN.
CREATE POLICY "payments_prevent_client_delete"
  ON public.payments
  FOR DELETE
  TO authenticated
  USING (false);

-- ── 8. AUDIT EVENTS POLICIES ───────────────────────────────────────────────

-- Users can view audit events for which they were the actor or are a contract party
CREATE POLICY "audit_events_select_actor"
  ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

-- Direct client INSERT/UPDATE/DELETE are strictly FORBIDDEN.
-- Only the backend server with privileged context records verified audit events.
CREATE POLICY "audit_events_prevent_client_insert"
  ON public.audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
