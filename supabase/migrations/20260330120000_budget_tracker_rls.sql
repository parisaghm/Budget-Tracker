-- Budget Tracker: RLS, FKs, indexes
-- Schema alignment with this repo: column "month" (YYYY-MM text), goals use target_cents/saved_cents.
-- If your database uses month_key or different names, rename columns before applying or adjust this file.

-- ---------------------------------------------------------------------------
-- 1) user_id on all user-owned tables (idempotent)
-- ---------------------------------------------------------------------------
alter table if exists public.budget_months
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.expenses
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.categories
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.goals
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.goal_contributions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table if exists public.income_history
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Optional columns used by this app (category limits)
alter table if exists public.categories
  add column if not exists month text;

alter table if exists public.categories
  add column if not exists limit_cents integer;

-- ---------------------------------------------------------------------------
-- 2) Foreign keys: referential integrity + join safety
-- Fails if orphan rows exist (fix data before applying).
-- ---------------------------------------------------------------------------
do $block$
begin
  alter table public.expenses
    add constraint expenses_budget_month_id_fkey
    foreign key (budget_month_id) references public.budget_months (id) on delete cascade;
exception
  when duplicate_object then null;
  when undefined_column then
    raise notice 'expenses.budget_month_id missing; add column then add FK manually';
  when undefined_table then
    raise notice 'public.expenses missing; create table then re-run';
end
$block$;

do $block$
begin
  alter table public.goal_contributions
    add constraint goal_contributions_goal_id_fkey
    foreign key (goal_id) references public.goals (id) on delete cascade;
exception
  when duplicate_object then null;
  when undefined_column then
    raise notice 'goal_contributions.goal_id missing; add column then add FK manually';
  when undefined_table then
    raise notice 'public.goal_contributions missing; create table then re-run';
end
$block$;

-- ---------------------------------------------------------------------------
-- 3) Unique constraints / indexes (per-user + common filters)
-- ---------------------------------------------------------------------------
create unique index if not exists budget_months_user_month_uidx on public.budget_months (user_id, month);

create unique index if not exists income_history_user_month_uidx on public.income_history (user_id, month);

-- Supports category limit upserts: one row per (user, category value, month) for limit rows
create unique index if not exists categories_user_value_month_uidx
  on public.categories (user_id, value, coalesce(month, ''));

create index if not exists expenses_user_id_idx on public.expenses (user_id);

create index if not exists expenses_budget_month_id_idx on public.expenses (budget_month_id);

create index if not exists categories_user_id_idx on public.categories (user_id);

create index if not exists goals_user_id_idx on public.goals (user_id);

create index if not exists goal_contributions_user_id_idx on public.goal_contributions (user_id);

create index if not exists goal_contributions_goal_id_idx on public.goal_contributions (goal_id);

create index if not exists income_history_user_id_idx on public.income_history (user_id);

-- After backfilling user_id everywhere, optionally enforce NOT NULL:
-- alter table public.budget_months alter column user_id set not null;
-- (repeat for each table)

-- ---------------------------------------------------------------------------
-- 4) Enable RLS
-- ---------------------------------------------------------------------------
alter table if exists public.budget_months enable row level security;

alter table if exists public.expenses enable row level security;

alter table if exists public.categories enable row level security;

alter table if exists public.goals enable row level security;

alter table if exists public.goal_contributions enable row level security;

alter table if exists public.income_history enable row level security;

-- ---------------------------------------------------------------------------
-- 5) Drop legacy policies (single-policy or split names)
-- ---------------------------------------------------------------------------
drop policy if exists "budget_months_owner_all" on public.budget_months;

drop policy if exists "expenses_owner_all" on public.expenses;

drop policy if exists "categories_owner_all" on public.categories;

drop policy if exists "goals_owner_all" on public.goals;

drop policy if exists "goal_contributions_owner_all" on public.goal_contributions;

drop policy if exists "income_history_owner_all" on public.income_history;

drop policy if exists "budget_months_select_own" on public.budget_months;

drop policy if exists "budget_months_insert_own" on public.budget_months;

drop policy if exists "budget_months_update_own" on public.budget_months;

drop policy if exists "budget_months_delete_own" on public.budget_months;

drop policy if exists "expenses_select_own" on public.expenses;

drop policy if exists "expenses_insert_own" on public.expenses;

drop policy if exists "expenses_update_own" on public.expenses;

drop policy if exists "expenses_delete_own" on public.expenses;

drop policy if exists "categories_select_own" on public.categories;

drop policy if exists "categories_insert_own" on public.categories;

drop policy if exists "categories_update_own" on public.categories;

drop policy if exists "categories_delete_own" on public.categories;

drop policy if exists "goals_select_own" on public.goals;

drop policy if exists "goals_insert_own" on public.goals;

drop policy if exists "goals_update_own" on public.goals;

drop policy if exists "goals_delete_own" on public.goals;

drop policy if exists "goal_contributions_select_own" on public.goal_contributions;

drop policy if exists "goal_contributions_insert_own" on public.goal_contributions;

drop policy if exists "goal_contributions_update_own" on public.goal_contributions;

drop policy if exists "goal_contributions_delete_own" on public.goal_contributions;

drop policy if exists "income_history_select_own" on public.income_history;

drop policy if exists "income_history_insert_own" on public.income_history;

drop policy if exists "income_history_update_own" on public.income_history;

drop policy if exists "income_history_delete_own" on public.income_history;

-- ---------------------------------------------------------------------------
-- 6) Policies: budget_months
-- ---------------------------------------------------------------------------
create policy "budget_months_select_own" on public.budget_months for select to authenticated using (user_id = auth.uid());

create policy "budget_months_insert_own" on public.budget_months for insert to authenticated with check (user_id = auth.uid());

create policy "budget_months_update_own" on public.budget_months for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "budget_months_delete_own" on public.budget_months for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) Policies: expenses (ownership + same-user budget_month)
-- ---------------------------------------------------------------------------
create policy "expenses_select_own" on public.expenses for select to authenticated using (user_id = auth.uid());

create policy "expenses_insert_own" on public.expenses for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.budget_months bm
    where bm.id = budget_month_id
      and bm.user_id = auth.uid()
  )
);

create policy "expenses_update_own" on public.expenses for update to authenticated using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.budget_months bm
    where bm.id = budget_month_id
      and bm.user_id = auth.uid()
  )
);

create policy "expenses_delete_own" on public.expenses for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8) Policies: categories
-- ---------------------------------------------------------------------------
create policy "categories_select_own" on public.categories for select to authenticated using (user_id = auth.uid());

create policy "categories_insert_own" on public.categories for insert to authenticated with check (user_id = auth.uid());

create policy "categories_update_own" on public.categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories_delete_own" on public.categories for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 9) Policies: goals
-- ---------------------------------------------------------------------------
create policy "goals_select_own" on public.goals for select to authenticated using (user_id = auth.uid());

create policy "goals_insert_own" on public.goals for insert to authenticated with check (user_id = auth.uid());

create policy "goals_update_own" on public.goals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goals_delete_own" on public.goals for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 10) Policies: goal_contributions (ownership + same-user goal)
-- ---------------------------------------------------------------------------
create policy "goal_contributions_select_own" on public.goal_contributions for select to authenticated using (user_id = auth.uid());

create policy "goal_contributions_insert_own" on public.goal_contributions for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.goals g
    where g.id = goal_id
      and g.user_id = auth.uid()
  )
);

create policy "goal_contributions_update_own" on public.goal_contributions for update to authenticated using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.goals g
    where g.id = goal_id
      and g.user_id = auth.uid()
  )
);

create policy "goal_contributions_delete_own" on public.goal_contributions for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11) Policies: income_history
-- ---------------------------------------------------------------------------
create policy "income_history_select_own" on public.income_history for select to authenticated using (user_id = auth.uid());

create policy "income_history_insert_own" on public.income_history for insert to authenticated with check (user_id = auth.uid());

create policy "income_history_update_own" on public.income_history for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "income_history_delete_own" on public.income_history for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 12) RPC: keep in sync with app (security definer; validates caller)
-- ---------------------------------------------------------------------------
create or replace function public.increment_goal_saved_cents(
  p_goal_id uuid,
  p_user_id uuid,
  p_amount_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Not allowed';
  end if;

  update public.goals
  set
    saved_cents = saved_cents + p_amount_cents
  where id = p_goal_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.increment_goal_saved_cents(uuid, uuid, integer) from public;

grant execute on function public.increment_goal_saved_cents(uuid, uuid, integer) to authenticated;
