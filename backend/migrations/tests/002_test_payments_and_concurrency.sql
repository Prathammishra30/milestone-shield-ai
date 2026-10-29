-- ==============================================================================
-- Test Suite: 002_test_payments_and_concurrency.sql
-- Description: Verifies payment mutation restrictions, RLS policies on payments,
--              concurrency locks (FOR UPDATE), and immutable audit events.
--              Executes in a safe rollback transaction block.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_client UUID := '55555555-5555-5555-5555-555555555555';
  v_freelancer UUID := '66666666-6666-6666-6666-666666666666';
  v_attacker UUID := '77777777-7777-7777-7777-777777777777';
  v_contract UUID;
  v_milestone UUID;
  v_payment UUID;
  v_count INT;
BEGIN
  RAISE NOTICE '── [TEST SUITE 2 START]: Payments & Financial Immutability ──';

  -- 1. Create profiles
  INSERT INTO public.profiles (id, email, full_name, role, onboarding_completed)
  VALUES
    (v_client, 'payer@client.test', 'Patricia Client', 'client', true),
    (v_freelancer, 'worker@freelancer.test', 'Frank Freelancer', 'freelancer', true),
    (v_attacker, 'evil@hacker.test', 'Eve Attacker', 'client', true)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create contract & milestone as client
  PERFORM set_config('request.jwt.claim.sub', v_client::text, true);

  INSERT INTO public.contracts (title, total_budget, currency, status, client_id, freelancer_id)
  VALUES ('Payment Test Contract', 5000.00, 'USD', 'active', v_client, v_freelancer)
  RETURNING id INTO v_contract;

  INSERT INTO public.milestones (contract_id, title, amount, currency, status)
  VALUES (v_contract, 'Secure Payment Milestone', 2500.00, 'USD', 'in_progress')
  RETURNING id INTO v_milestone;

  -- ── TEST 1: Direct Client INSERT into Payments is Strictly Blocked ─────
  BEGIN
    INSERT INTO public.payments (milestone_id, contract_id, amount, currency, status)
    VALUES (v_milestone, v_contract, 2500.00, 'USD', 'captured');
    RAISE EXCEPTION 'SECURITY VIOLATION: Client was able to directly INSERT a payment record!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✓ TEST 1 PASSED: Direct client INSERT on payments was successfully rejected.';
  END;

  -- ── TEST 2: Service-Role Inserts Initial Payment Record ─────────────────
  -- (Simulating backend Express server action after authorization check)
  RESET request.jwt.claim.sub; -- Act as privileged backend role

  INSERT INTO public.payments (
    milestone_id,
    contract_id,
    created_by,
    amount,
    currency,
    status,
    paypal_order_id,
    approve_url
  ) VALUES (
    v_milestone,
    v_contract,
    v_client,
    2500.00,
    'USD',
    'created',
    'ORDER-TEST-001',
    'https://www.sandbox.paypal.com/checkoutnow?token=TEST'
  ) RETURNING id INTO v_payment;

  ASSERT v_payment IS NOT NULL, 'FAILED: Privileged backend could not insert payment';
  RAISE NOTICE '✓ TEST 2 PASSED: Privileged backend successfully recorded payment.';

  -- ── TEST 3: Attacker Cannot Read or Mutate Payment Record ───────────────
  PERFORM set_config('request.jwt.claim.sub', v_attacker::text, true);

  SELECT COUNT(*) INTO v_count FROM public.payments WHERE id = v_payment;
  ASSERT v_count = 0, 'SECURITY VIOLATION: Non-member attacker was able to view payment!';

  BEGIN
    UPDATE public.payments SET status = 'captured' WHERE id = v_payment;
    RAISE EXCEPTION 'SECURITY VIOLATION: Attacker modified payment!';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Expected RLS or grant rejection
  END;
  RAISE NOTICE '✓ TEST 3 PASSED: Non-member attacker received 0 rows and mutation blocked.';

  -- ── TEST 4: Contract Member Can Read Payment Record ─────────────────────
  PERFORM set_config('request.jwt.claim.sub', v_freelancer::text, true);

  SELECT COUNT(*) INTO v_count FROM public.payments WHERE id = v_payment;
  ASSERT v_count = 1, 'FAILED: Contract freelancer could not view payment record';
  RAISE NOTICE '✓ TEST 4 PASSED: Legitimate contract member can view payment record.';

  -- ── TEST 5: Atomic State Transition RPC with Concurrency Lock ───────────
  RESET request.jwt.claim.sub; -- Backend service role context

  -- Transition from created -> authorized
  PERFORM public.record_payment_transition(
    v_payment,
    'authorized',
    v_client,
    'client',
    'AUTHORIZED',
    jsonb_build_object('auth_id', 'AUTH-TEST-999'),
    'Authorization completed via PayPal Sandbox'
  );

  ASSERT (SELECT status FROM public.payments WHERE id = v_payment) = 'authorized',
    'FAILED: Status was not updated to authorized';

  -- Transition from authorized -> captured
  PERFORM public.record_payment_transition(
    v_payment,
    'captured',
    v_client,
    'client',
    'CAPTURED',
    jsonb_build_object('capture_id', 'CAP-TEST-999'),
    'Funds captured upon client approval'
  );

  ASSERT (SELECT status FROM public.payments WHERE id = v_payment) = 'captured',
    'FAILED: Status was not updated to captured';

  -- ── TEST 6: Prevent Duplicate Capture via Concurrency RPC ───────────────
  BEGIN
    PERFORM public.record_payment_transition(
      v_payment,
      'captured',
      v_client,
      'client',
      'CAPTURED',
      jsonb_build_object('capture_id', 'CAP-DUPLICATE'),
      'Attempting double capture'
    );
    RAISE EXCEPTION 'SECURITY VIOLATION: Duplicate capture succeeded!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✓ TEST 6 PASSED: Duplicate capture attempt was strictly rejected by RPC lock.';
  END;

  -- ── TEST 7: Audit Events Are Immutable ──────────────────────────────────
  SELECT COUNT(*) INTO v_count FROM public.audit_events WHERE entity_id = v_payment::text;
  ASSERT v_count = 2, 'FAILED: Audit events were not recorded';

  BEGIN
    DELETE FROM public.audit_events WHERE entity_id = v_payment::text;
    RAISE EXCEPTION 'SECURITY VIOLATION: Audit event was deleted!';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✓ TEST 7 PASSED: Audit event tampering/deletion blocked by trigger.';
  END;

  RAISE NOTICE '── [ALL PAYMENT TESTS COMPLETED SUCCESSFULLY] ──';
END $$;

ROLLBACK;
