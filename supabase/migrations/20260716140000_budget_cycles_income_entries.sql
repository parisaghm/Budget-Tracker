-- Explicit budget cycles + income entries (single source of truth for income).
-- Half-open ranges: start_date <= date < end_date
-- Idempotent cycle creation via UNIQUE (user_id, start_date) + ensure_budget_cycle RPC.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- budget_cycles
-- ---------------------------------------------------------------------------
create table if not exists public.budget_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'active'
    check (status in ('active', 'closed', 'scheduled')),
  schedule_type text not null,
  created_at timestamptz not null default now(),
  constraint budget_cycles_end_after_start check (end_date > start_date)
);

alter table public.budget_cycles
  drop constraint if exists budget_cycles_user_start_key;

alter table public.budget_cycles
  add constraint budget_cycles_user_start_key unique (user_id, start_date);

create index if not exists budget_cycles_user_status_idx
  on public.budget_cycles (user_id, status);

create index if not exists budget_cycles_user_range_idx
  on public.budget_cycles (user_id, start_date, end_date);

-- Prevent overlapping half-open ranges per user: [start, end)
alter table public.budget_cycles
  drop constraint if exists budget_cycles_no_overlap;

alter table public.budget_cycles
  add constraint budget_cycles_no_overlap
  exclude using gist (
    user_id with =,
    daterange(start_date, end_date, '[)') with &&
  );

alter table public.budget_cycles enable row level security;

drop policy if exists "budget_cycles_select_own" on public.budget_cycles;
drop policy if exists "budget_cycles_insert_own" on public.budget_cycles;
drop policy if exists "budget_cycles_update_own" on public.budget_cycles;
drop policy if exists "budget_cycles_delete_own" on public.budget_cycles;

create policy "budget_cycles_select_own"
  on public.budget_cycles for select to authenticated
  using (user_id = auth.uid());

create policy "budget_cycles_insert_own"
  on public.budget_cycles for insert to authenticated
  with check (user_id = auth.uid());

create policy "budget_cycles_update_own"
  on public.budget_cycles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "budget_cycles_delete_own"
  on public.budget_cycles for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- income_entries
-- ---------------------------------------------------------------------------
create table if not exists public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle_id uuid not null references public.budget_cycles (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  received_date date,
  source text,
  note text,
  date_is_estimated boolean not null default false,
  legacy_budget_month_id uuid,
  created_at timestamptz not null default now()
);

-- NULLs are distinct in Postgres UNIQUE, so non-migrated rows may omit the marker.
alter table public.income_entries
  drop constraint if exists income_entries_legacy_budget_month_key;

alter table public.income_entries
  add constraint income_entries_legacy_budget_month_key unique (legacy_budget_month_id);

create index if not exists income_entries_user_cycle_idx
  on public.income_entries (user_id, cycle_id);

create index if not exists income_entries_cycle_idx
  on public.income_entries (cycle_id);

alter table public.income_entries enable row level security;

drop policy if exists "income_entries_select_own" on public.income_entries;
drop policy if exists "income_entries_insert_own" on public.income_entries;
drop policy if exists "income_entries_update_own" on public.income_entries;
drop policy if exists "income_entries_delete_own" on public.income_entries;

create policy "income_entries_select_own"
  on public.income_entries for select to authenticated
  using (user_id = auth.uid());

create policy "income_entries_insert_own"
  on public.income_entries for insert to authenticated
  with check (user_id = auth.uid());

create policy "income_entries_update_own"
  on public.income_entries for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "income_entries_delete_own"
  on public.income_entries for delete to authenticated
  using (user_id = auth.uid());

-- Ownership: income_entries.user_id must match budget_cycles.user_id
create or replace function public.income_entries_enforce_cycle_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  cycle_owner uuid;
begin
  select user_id into cycle_owner
  from public.budget_cycles
  where id = new.cycle_id;

  if cycle_owner is null then
    raise exception 'income_entries: cycle_id % not found', new.cycle_id;
  end if;

  if cycle_owner <> new.user_id then
    raise exception 'income_entries: user_id must match budget_cycles.user_id';
  end if;

  return new;
end;
$$;

drop trigger if exists income_entries_enforce_cycle_owner_trg on public.income_entries;
create trigger income_entries_enforce_cycle_owner_trg
  before insert or update of user_id, cycle_id
  on public.income_entries
  for each row
  execute function public.income_entries_enforce_cycle_owner();

-- ---------------------------------------------------------------------------
-- Idempotent ensure_budget_cycle (returns existing on unique conflict)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_budget_cycle(
  p_start_date date,
  p_end_date date,
  p_schedule_type text,
  p_status text default 'active'
)
returns public.budget_cycles
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.budget_cycles;
begin
  if uid is null then
    raise exception 'ensure_budget_cycle: not authenticated';
  end if;

  if p_end_date <= p_start_date then
    raise exception 'ensure_budget_cycle: end_date must be after start_date';
  end if;

  if p_status not in ('active', 'closed', 'scheduled') then
    raise exception 'ensure_budget_cycle: invalid status';
  end if;

  insert into public.budget_cycles (user_id, start_date, end_date, status, schedule_type)
  values (uid, p_start_date, p_end_date, p_status, p_schedule_type)
  on conflict (user_id, start_date) do nothing
  returning * into result;

  if result.id is null then
    select * into result
    from public.budget_cycles
    where user_id = uid and start_date = p_start_date;
  end if;

  return result;
end;
$$;

revoke all on function public.ensure_budget_cycle(date, date, text, text) from public;
grant execute on function public.ensure_budget_cycle(date, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Idempotent backfill from budget_months (estimated dates)
-- ---------------------------------------------------------------------------
do $$
declare
  bm record;
  cycle_row public.budget_cycles;
  start_d date;
  end_d date;
  st text;
  today_d date := (timezone('utc', now()))::date;
begin
  for bm in
    select id, user_id, month, salary_cents, income_note
    from public.budget_months
    where salary_cents > 0
      and user_id is not null
      and month ~ '^\d{4}-\d{2}$'
  loop
    start_d := (bm.month || '-01')::date;
    end_d := (start_d + interval '1 month')::date;
    st := case when start_d <= today_d and today_d < end_d then 'active' else 'closed' end;

    insert into public.budget_cycles (user_id, start_date, end_date, status, schedule_type)
    values (bm.user_id, start_d, end_d, st, 'legacy_month')
    on conflict (user_id, start_date) do nothing;

    select * into cycle_row
    from public.budget_cycles
    where user_id = bm.user_id and start_date = start_d;

    if cycle_row.id is null then
      continue;
    end if;

    insert into public.income_entries (
      user_id,
      cycle_id,
      amount_cents,
      received_date,
      source,
      note,
      date_is_estimated,
      legacy_budget_month_id
    )
    values (
      bm.user_id,
      cycle_row.id,
      bm.salary_cents,
      start_d,
      'migrated',
      bm.income_note,
      true,
      bm.id
    )
    on conflict (legacy_budget_month_id) do nothing;
  end loop;
end;
$$;
