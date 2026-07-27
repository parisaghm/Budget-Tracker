-- Cycle-scoped goal contributions + atomic save_cycle_goal_allocation RPC.
-- Do not apply remotely until reviewed. Does not delete historical contributions.

-- ---------------------------------------------------------------------------
-- 1) Schema
-- ---------------------------------------------------------------------------
alter table if exists public.goal_contributions
  add column if not exists cycle_id uuid references public.budget_cycles (id) on delete set null;

alter table if exists public.goal_contributions
  add column if not exists contribution_date date;

create index if not exists goal_contributions_cycle_id_idx
  on public.goal_contributions (cycle_id)
  where cycle_id is not null;

-- Upsert-compatible unique constraint. NULL cycle_id rows (legacy) are allowed
-- multiple times because PostgreSQL treats each NULL as distinct in UNIQUE.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goal_contributions_user_goal_cycle_unique'
      and conrelid = 'public.goal_contributions'::regclass
  ) then
    alter table public.goal_contributions
      add constraint goal_contributions_user_goal_cycle_unique
      unique (user_id, goal_id, cycle_id);
  end if;
exception
  when undefined_table then
    raise notice 'public.goal_contributions missing; create table then re-run';
end $$;

-- ---------------------------------------------------------------------------
-- 2) Helpers: months remaining (matches date-fns differenceInMonths on month starts)
-- ---------------------------------------------------------------------------
create or replace function public.goal_months_remaining(p_target_date date)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(
    0,
    (
      (extract(year from date_trunc('month', p_target_date::timestamp))::integer
        - extract(year from date_trunc('month', current_date::timestamp))::integer) * 12
      + (extract(month from date_trunc('month', p_target_date::timestamp))::integer
        - extract(month from date_trunc('month', current_date::timestamp))::integer)
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Server-authoritative planned savings for a cycle
-- When "Monthly savings plan" exists, it alone is the planned amount.
-- Individual goals are allocation targets only (not summed into the plan).
-- ---------------------------------------------------------------------------
create or replace function public.compute_cycle_planned_savings_cents(
  p_user_id uuid,
  p_cycle_id uuid
)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_cycle record;
  v_month_key text;
  v_adjustments jsonb;
  v_paused jsonb;
  v_realloc jsonb;
  v_allocation integer := 0;
  v_paused_boost integer := 0;
  v_realloc_boost integer := 0;
  v_goal record;
  v_cycle_allocated integer;
  v_effective_saved integer;
  v_remaining integer;
  v_months integer;
  v_monthly integer;
  v_paused_ids text[];
  v_meta_name constant text := 'Monthly savings plan';
  v_has_meta boolean := false;
  v_meta_id uuid;
begin
  select * into v_cycle
  from public.budget_cycles
  where id = p_cycle_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Cycle not found or not owned';
  end if;

  v_month_key := to_char(v_cycle.start_date, 'YYYY-MM');

  select coalesce(us.month_adjustments -> v_month_key, '{}'::jsonb)
  into v_adjustments
  from public.user_settings us
  where us.user_id = p_user_id;

  v_adjustments := coalesce(v_adjustments, '{}'::jsonb);
  v_paused := coalesce(v_adjustments -> 'pausedGoalIds', '[]'::jsonb);
  v_realloc := coalesce(v_adjustments -> 'goalReallocationCents', '{}'::jsonb);

  select coalesce(array_agg(value #>> '{}'), array[]::text[])
  into v_paused_ids
  from jsonb_array_elements(v_paused);

  select exists (
    select 1 from public.goals g
    where g.user_id = p_user_id and g.name = v_meta_name
  ) into v_has_meta;

  if v_has_meta then
    select g.id, g.target_cents, g.saved_cents, g.target_date, g.name
    into v_goal
    from public.goals g
    where g.user_id = p_user_id and g.name = v_meta_name
    limit 1;

    v_meta_id := v_goal.id;

    -- Authoritative plan = onboarding monthly amount stored as target_cents / 12.
    -- Do NOT sum allocation-goal recommendations; do NOT use months-remaining math.
    v_allocation := greatest(0, round(coalesce(v_goal.target_cents, 0)::numeric / 12.0)::integer);

    if v_allocation <= 0 then
      return 0;
    end if;

    if v_meta_id::text = any (v_paused_ids) then
      v_paused_boost := v_allocation;
    end if;

    v_realloc_boost := coalesce((v_realloc ->> v_meta_id::text)::integer, 0);
  else
    -- No authoritative Monthly savings plan — do not invent a sum of goals.
    return 0;
  end if;

  return greatest(0, v_allocation - v_paused_boost - coalesce(v_realloc_boost, 0));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Atomic allocation RPC
-- ---------------------------------------------------------------------------
create or replace function public.save_cycle_goal_allocation(
  p_cycle_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cycle record;
  v_server_planned integer;
  v_proposed_total integer := 0;
  v_elem jsonb;
  v_goal_id uuid;
  v_amount integer;
  v_seen uuid[] := array[]::uuid[];
  v_eligible uuid[];
  v_payload_ids uuid[] := array[]::uuid[];
  v_legacy_ids uuid[];
  v_existing_cycle_amount integer;
  v_meta_name constant text := 'Monthly savings plan';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'allocations must be a JSON array';
  end if;

  -- Lock owned cycle
  select * into v_cycle
  from public.budget_cycles
  where id = p_cycle_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'Cycle not found or not owned';
  end if;

  -- Eligible goals: all owned goals except onboarding meta plan
  select coalesce(array_agg(g.id order by g.created_at, g.id), array[]::uuid[])
  into v_eligible
  from public.goals g
  where g.user_id = v_uid
    and g.name is distinct from v_meta_name;

  -- Parse + validate payload
  for v_elem in select * from jsonb_array_elements(p_allocations)
  loop
    if jsonb_typeof(v_elem -> 'goal_id') is distinct from 'string'
       and jsonb_typeof(v_elem -> 'goal_id') is distinct from 'null' then
      -- allow uuid as string
      null;
    end if;

    begin
      v_goal_id := (v_elem ->> 'goal_id')::uuid;
    exception
      when others then
        raise exception 'Invalid goal_id in allocations';
    end;

    if v_goal_id is null then
      raise exception 'goal_id is required';
    end if;

    if v_goal_id = any (v_seen) then
      raise exception 'Duplicate goal_id in allocations';
    end if;
    v_seen := array_append(v_seen, v_goal_id);
    v_payload_ids := array_append(v_payload_ids, v_goal_id);

    -- amount_cents must be integer >= 0 (reject decimals / negatives / non-numbers)
    if not (v_elem ? 'amount_cents') then
      raise exception 'amount_cents is required';
    end if;
    if jsonb_typeof(v_elem -> 'amount_cents') <> 'number' then
      raise exception 'amount_cents must be an integer number of cents';
    end if;
    if (v_elem ->> 'amount_cents') !~ '^-?[0-9]+$' then
      raise exception 'amount_cents must be an integer (no decimals)';
    end if;

    v_amount := (v_elem ->> 'amount_cents')::integer;
    if v_amount < 0 then
      raise exception 'amount_cents cannot be negative';
    end if;

    -- Ownership + eligibility
    if not exists (
      select 1 from public.goals g
      where g.id = v_goal_id and g.user_id = v_uid
    ) then
      raise exception 'Goal not found or not owned';
    end if;

    if exists (
      select 1 from public.goals g
      where g.id = v_goal_id and g.user_id = v_uid and g.name = v_meta_name
    ) then
      raise exception 'Cannot allocate to the monthly savings plan goal';
    end if;

    v_proposed_total := v_proposed_total + v_amount;
  end loop;

  -- Complete final state: every eligible goal must appear
  if coalesce(array_length(v_eligible, 1), 0) <> coalesce(array_length(v_payload_ids, 1), 0)
     or exists (
       select 1
       from unnest(v_eligible) e(id)
       where not (e.id = any (v_payload_ids))
     ) then
    raise exception 'Payload must include the complete final state for all eligible goals';
  end if;

  -- Lock existing cycle-scoped contribution rows
  perform 1
  from public.goal_contributions
  where user_id = v_uid
    and cycle_id = p_cycle_id
  for update;

  -- Server-authoritative planned savings (never trust client)
  v_server_planned := public.compute_cycle_planned_savings_cents(v_uid, p_cycle_id);

  if v_server_planned <= 0 then
    raise exception 'Savings plan not set. Set your monthly savings plan first.';
  end if;

  if v_proposed_total > v_server_planned then
    raise exception
      'Your allocation exceeds this cycle''s savings plan. Increase your savings plan first. (proposed %, planned %)',
      v_proposed_total, v_server_planned;
  end if;

  -- Apply final allocation per goal + consolidate legacy
  for v_elem in select * from jsonb_array_elements(p_allocations)
  loop
    v_goal_id := (v_elem ->> 'goal_id')::uuid;
    v_amount := (v_elem ->> 'amount_cents')::integer;

    -- Collect legacy row ids in cycle window (do not bulk-assign cycle_id)
    select coalesce(array_agg(gc.id), array[]::uuid[])
    into v_legacy_ids
    from public.goal_contributions gc
    where gc.user_id = v_uid
      and gc.goal_id = v_goal_id
      and gc.cycle_id is null
      and gc.created_at >= v_cycle.start_date::timestamptz
      and gc.created_at < (v_cycle.end_date + 1)::timestamptz;

    select coalesce(gc.amount_cents, 0)
    into v_existing_cycle_amount
    from public.goal_contributions gc
    where gc.user_id = v_uid
      and gc.goal_id = v_goal_id
      and gc.cycle_id = p_cycle_id;

    if v_amount > 0 then
      insert into public.goal_contributions (
        user_id, goal_id, amount_cents, cycle_id, contribution_date
      ) values (
        v_uid,
        v_goal_id,
        v_amount,
        p_cycle_id,
        v_cycle.start_date
      )
      on conflict (user_id, goal_id, cycle_id)
      do update set
        amount_cents = excluded.amount_cents,
        contribution_date = excluded.contribution_date;
    else
      delete from public.goal_contributions
      where user_id = v_uid
        and goal_id = v_goal_id
        and cycle_id = p_cycle_id;
    end if;

    -- Delete only legacy rows that were consolidated for this goal/window
    if coalesce(array_length(v_legacy_ids, 1), 0) > 0 then
      delete from public.goal_contributions
      where id = any (v_legacy_ids)
        and user_id = v_uid
        and goal_id = v_goal_id
        and cycle_id is null;
    end if;
  end loop;

  -- Recompute saved_cents from the full contribution ledger (no blind deltas)
  update public.goals g
  set saved_cents = (
    select coalesce(sum(gc.amount_cents), 0)::integer
    from public.goal_contributions gc
    where gc.goal_id = g.id
      and gc.user_id = v_uid
  )
  where g.user_id = v_uid
    and g.id = any (v_payload_ids);
end;
$$;

revoke all on function public.save_cycle_goal_allocation(uuid, jsonb) from public;
revoke all on function public.save_cycle_goal_allocation(uuid, jsonb) from anon;
grant execute on function public.save_cycle_goal_allocation(uuid, jsonb) to authenticated;

revoke all on function public.compute_cycle_planned_savings_cents(uuid, uuid) from public;
revoke all on function public.compute_cycle_planned_savings_cents(uuid, uuid) from anon;
grant execute on function public.compute_cycle_planned_savings_cents(uuid, uuid) to authenticated;

revoke all on function public.goal_months_remaining(date) from public;
revoke all on function public.goal_months_remaining(date) from anon;
grant execute on function public.goal_months_remaining(date) to authenticated;

comment on function public.save_cycle_goal_allocation(uuid, jsonb) is
  'Atomically sets the complete final goal allocation for a budget cycle. Server derives planned savings; consolidates legacy NULL cycle_id rows; recomputes goals.saved_cents from contribution sums.';
