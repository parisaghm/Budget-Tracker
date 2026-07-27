-- Acceptance scenarios for save_cycle_goal_allocation
-- Manual / SQL-editor checklist. Do NOT run against production without a review.
-- These are documentation + optional DO-block templates; they require a seeded test user.

/*
Acceptance matrix
=================

1) False client planned savings limit
   - RPC does not accept client planned_savings_cents.
   - Server uses compute_cycle_planned_savings_cents only.
   - Status: covered by function signature (p_cycle_id, p_allocations only).

2) Allocation exceeds server-calculated plan
   - Call save_cycle_goal_allocation with sum(amount_cents) > server planned.
   - Expect: exception containing "exceeds this cycle's savings plan".

3) Another user's goal
   - Include a goal_id owned by a different user.
   - Expect: "Goal not found or not owned".

4) Duplicate goal IDs
   - Payload with the same goal_id twice.
   - Expect: "Duplicate goal_id in allocations".

5) Two legacy rows for the same goal in one cycle window
   - Insert two goal_contributions with cycle_id NULL in the cycle window.
   - Call save with final amount for that goal.
   - Expect: one cycle-scoped row; legacy rows deleted; saved_cents = sum(remaining ledger).

6) Existing €300 allocation edited to €500 (within plan)
   - Upsert updates the same (user_id, goal_id, cycle_id) row.
   - Expect: still one row; amount_cents = 50000; saved_cents recomputed.

7) Allocation changed to zero
   - Submit amount_cents = 0 for a goal.
   - Expect: cycle-scoped row deleted; saved_cents recomputed without that amount.

8) Concurrent double submission
   - Two sessions call with the same final payload.
   - Expect: UNIQUE (user_id, goal_id, cycle_id) keeps a single row; second call is idempotent final-state write; FOR UPDATE on cycle serializes writers.

9) Mid-RPC failure rolls back
   - Any exception after partial writes rolls back the whole transaction (PL/pgSQL function body is atomic).
   - Expect: no orphan contribution changes without matching goals.saved_cents update.

Example negative test (run as authenticated test user):

-- select public.save_cycle_goal_allocation(
--   '<cycle-uuid>'::uuid,
--   '[{"goal_id":"<goal-a>","amount_cents":999999999},{"goal_id":"<goal-b>","amount_cents":0}]'::jsonb
-- );
-- Expect error: exceeds savings plan

Example duplicate test:

-- select public.save_cycle_goal_allocation(
--   '<cycle-uuid>'::uuid,
--   '[{"goal_id":"<goal-a>","amount_cents":100},{"goal_id":"<goal-a>","amount_cents":200}]'::jsonb
-- );
-- Expect error: Duplicate goal_id

Security checks (as superuser):

-- select has_function_privilege('anon', 'public.save_cycle_goal_allocation(uuid,jsonb)', 'execute');
-- Expect: false
-- select has_function_privilege('authenticated', 'public.save_cycle_goal_allocation(uuid,jsonb)', 'execute');
-- Expect: true
*/

select 'save_cycle_goal_allocation acceptance checklist loaded' as status;
