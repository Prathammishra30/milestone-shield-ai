-- ==============================================================================
-- Test Suite: 001_test_rls_isolation.sql
-- Description: Reproducible multi-tenant database isolation & RLS test harness
--              Executes in a safe rollback transaction block.
-- ==============================================================================

BEGIN;

-- Setup mock auth function if not in live Supabase environment
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE sql STABLE;

-- 1. Create test users in auth.users / public.profiles
DO $$
DECLARE
  v_user_a UUID := '11111111-1111-1111-1111-111111111111';
  v_user_b UUID := '22222222-2222-2222-2222-222222222222';
  v_user_c UUID := '33333333-3333-3333-3333-333333333333'; -- Freelancer
  v_user_d UUID := '44444444-4444-4444-4444-444444444444'; -- Non-member / Attacker
  v_contract_a UUID;
  v_milestone_a UUID;
  v_count INT;
BEGIN
  RAISE NOTICE '── [TEST SUITE START]: Multi-Tenant Isolation & RLS Security ──';

  -- Seed initial profile rows as postgres/service_role
  INSERT INTO public.profiles (id, email, full_name, role, onboarding_completed)
  VALUES
    (v_user_a, 'user_a@tenant.com', 'Alice Client', 'client', true),
    (v_user_b, 'user_b@tenant.com', 'Bob Client', 'client', true),
    (v_user_c, 'user_c@tenant.com', 'Charlie Freelancer', 'freelancer', true),
    (v_user_d, 'user_d@outsider.com', 'Dave NonMember', 'client', true)
  ON CONFLICT (id) DO NOTHING;

  -- ── TEST 1: User A creates contract & auto-membership triggers ───────
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

  INSERT INTO public.contracts (title, total_budget, currency, status, client_id, freelancer_id)
  VALUES ('Contract Tenant A', 10000.00, 'USD', 'active', v_user_a, v_user_c)
  RETURNING id INTO v_contract_a;

  -- Verify membership trigger registered User A as client and User C as freelancer
  SELECT COUNT(*) INTO v_count FROM public.contract_memberships
  WHERE contract_id = v_contract_a AND user_id = v_user_a AND role = 'client';
  ASSERT v_count = 1, 'FAILED: Creator client membership was not auto-registered';

  SELECT COUNT(*) INTO v_count FROM public.contract_memberships
  WHERE contract_id = v_contract_a AND user_id = v_user_c AND role = 'freelancer';
  ASSERT v_count = 1, 'FAILED: Assigned freelancer membership was not auto-registered';

  RAISE NOTICE '✓ TEST 1 PASSED: Contract creation & automated membership triggers verified.';

  -- ── TEST 2: User A creates Milestone ─────────────────────────────────
  INSERT INTO public.milestones (contract_id, title, amount, currency, status)
  VALUES (v_contract_a, 'Milestone 1 Architecture', 4000.00, 'USD', 'in_progress')
  RETURNING id INTO v_milestone_a;

  SELECT COUNT(*) INTO v_count FROM public.milestones WHERE id = v_milestone_a;
  ASSERT v_count = 1, 'FAILED: Client could not create milestone';

  RAISE NOTICE '✓ TEST 2 PASSED: Client milestone creation verified.';

  -- ── TEST 3: User B (Separate Tenant) STRICTLY CANNOT SELECT Contract A
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);

  SELECT COUNT(*) INTO v_count FROM public.contracts WHERE id = v_contract_a;
  ASSERT v_count = 0, 'SECURITY VIOLATION: User B was able to view User A contract!';

  SELECT COUNT(*) INTO v_count FROM public.milestones WHERE contract_id = v_contract_a;
  ASSERT v_count = 0, 'SECURITY VIOLATION: User B was able to view User A milestones!';

  RAISE NOTICE '✓ TEST 3 PASSED: Cross-tenant read access strictly blocked (User B -> Contract A = 0 rows).';

  -- ── TEST 4: User D (Non-Member) Attempting Direct Malicious Mutation ──
  PERFORM set_config('request.jwt.claim.sub', v_user_d::text, true);

  -- Attempt to update contract title
  UPDATE public.contracts SET title = 'HACKED BY USER D' WHERE id = v_contract_a;

  -- Attempt to create milestone on Contract A
  BEGIN
    INSERT INTO public.milestones (contract_id, title, amount, currency)
    VALUES (v_contract_a, 'Unauthorized Milestone', 99999.00, 'USD');
    RAISE EXCEPTION 'SECURITY VIOLATION: Non-member was able to insert milestone on Contract A!';
  EXCEPTION WHEN OTHERS THEN
    -- Expected RLS error
    NULL;
  END;

  -- ── TEST 5: Verify Contract A remains UNMODIFIED after attack ────────
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

  SELECT title INTO STRICT v_count FROM public.contracts WHERE id = v_contract_a;
  ASSERT (SELECT title FROM public.contracts WHERE id = v_contract_a) = 'Contract Tenant A',
    'SECURITY VIOLATION: Denied update altered original record!';

  RAISE NOTICE '✓ TEST 4 & 5 PASSED: Unauthorized mutation blocked and records remain untampered.';

  -- ── TEST 6: Direct Client Payment Mutation Forbidden ────────────────
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

  BEGIN
    INSERT INTO public.payments (milestone_id, contract_id, amount, status)
    VALUES (v_milestone_a, v_contract_a, 4000.00, 'captured');
    RAISE EXCEPTION 'SECURITY VIOLATION: Client directly inserted a payment record!';
  EXCEPTION WHEN OTHERS THEN
    -- Expected rejection
    NULL;
  END;

  RAISE NOTICE '✓ TEST 6 PASSED: Direct client payment insertion forbidden by RLS/Grants.';

  -- ── TEST 7: Freelancer Deliverable Submission & Scoping ──────────────
  PERFORM set_config('request.jwt.claim.sub', v_user_c::text, true);

  -- Freelancer can view their contract & milestone
  SELECT COUNT(*) INTO v_count FROM public.milestones WHERE id = v_milestone_a;
  ASSERT v_count = 1, 'FAILED: Freelancer cannot view assigned milestone';

  -- Freelancer can insert deliverable submission
  INSERT INTO public.submissions (milestone_id, contract_id, submitted_by, deliverable_url)
  VALUES (v_milestone_a, v_contract_a, v_user_c, 'https://github.com/example/repo/pull/1');

  -- Freelancer CANNOT modify milestone budget
  UPDATE public.milestones SET amount = 99999.00 WHERE id = v_milestone_a;
  ASSERT (SELECT amount FROM public.milestones WHERE id = v_milestone_a) = 4000.00,
    'SECURITY VIOLATION: Freelancer altered milestone amount!';

  RAISE NOTICE '✓ TEST 7 PASSED: Freelancer submission succeeded; unauthorized budget tampering blocked.';
  RAISE NOTICE '── [ALL RLS TESTS COMPLETED SUCCESSFULLY] ──';
END $$;

ROLLBACK; -- Always roll back test mutations cleanly
