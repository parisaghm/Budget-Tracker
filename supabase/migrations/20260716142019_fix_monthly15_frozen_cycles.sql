-- Corrective data migration for the 20260716140000 backfill.
--
-- That backfill froze budget_cycles as plain calendar months (schedule_type
-- 'legacy_month') even for users whose income cycle is payday-based. For the
-- affected monthly_15 user this produced Jun 1 - Jul 1 / Jul 1 - Aug 1 instead
-- of the real Jun 15 - Jul 15 / Jul 15 - Aug 15 windows, and duplicated the
-- carried-forward July income.
--
-- Every statement is guarded on the exact pre-correction state, so this
-- migration is idempotent and no-ops where the correction was already applied
-- directly (or on fresh databases where the rows do not exist).

-- 1) Remove the July carry-forward income artifact created by the backfill.
delete from public.income_entries
where id = '12f276d2-3c8e-4964-b8cb-324b2df01d64'
  and user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
  and cycle_id = '86090678-de55-464b-ae85-cccd16896cbd'
  and amount_cents = 437000
  and source = 'migrated'
  and date_is_estimated = true;

-- 2) Shrink the June legacy cycle to the Jun 1 - Jun 15 transition stub.
update public.budget_cycles
set end_date = '2026-06-15'
where id = '7dc664ff-09e1-4a71-b179-9230c61a9fbe'
  and user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
  and start_date = '2026-06-01'
  and end_date = '2026-07-01'
  and schedule_type = 'legacy_month';

-- 3) Move the July cycle to the frozen monthly_15 window.
update public.budget_cycles
set start_date = '2026-07-15',
    end_date = '2026-08-15',
    schedule_type = 'monthly_15'
where id = '86090678-de55-464b-ae85-cccd16896cbd'
  and user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
  and start_date = '2026-07-01'
  and end_date = '2026-08-01'
  and schedule_type = 'legacy_month';

-- 4) Create the real Jun 15 - Jul 15 cycle (closed).
insert into public.budget_cycles (user_id, start_date, end_date, status, schedule_type)
select '37b11ec6-c650-44d0-aa73-7c28dd90e31e', '2026-06-15', '2026-07-15', 'closed', 'monthly_15'
where exists (
  select 1 from public.budget_cycles
  where id = '7dc664ff-09e1-4a71-b179-9230c61a9fbe'
    and user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
)
on conflict (user_id, start_date) do nothing;

-- 5) Re-point the June income entry (EUR 4,370) to the Jun 15 - Jul 15 cycle.
update public.income_entries
set cycle_id = (
      select id from public.budget_cycles
      where user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
        and start_date = '2026-06-15'
    ),
    received_date = '2026-06-15'
where user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
  and cycle_id = '7dc664ff-09e1-4a71-b179-9230c61a9fbe'
  and amount_cents = 437000
  and source = 'migrated'
  and date_is_estimated = true
  and exists (
    select 1 from public.budget_cycles
    where user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
      and start_date = '2026-06-15'
  );

-- 6) Persist the EUR 117.40 savings reduction for budget month 2026-06 in
--    user_settings.month_adjustments. Guarded: never overwrites an existing
--    2026-06 entry.
update public.user_settings
set month_adjustments = coalesce(month_adjustments, '{}'::jsonb) || jsonb_build_object(
      '2026-06', jsonb_build_object(
        'rolloverBoostCents', 0,
        'weeklyReductionCents', 0,
        'leftoverCoverCents', 0,
        'pausedGoalIds', jsonb_build_array(),
        'dailyPaceTargetCents', null,
        'goalReallocationCents', jsonb_build_object('f0a76770-1d88-44c7-b427-9588502e7b4a', 11740)
      )
    ),
    updated_at = now()
where user_id = '37b11ec6-c650-44d0-aa73-7c28dd90e31e'
  and not (coalesce(month_adjustments, '{}'::jsonb) ? '2026-06');
