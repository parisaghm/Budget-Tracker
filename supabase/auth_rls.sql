-- 1) Schema updates for user-owned data
alter table if exists public.budget_months add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.expenses add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.categories add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.goals add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.goal_contributions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.income_history add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Optional helper columns used by this app's category limits logic.
alter table if exists public.categories add column if not exists month text;
alter table if exists public.categories add column if not exists limit_cents integer;

-- Useful constraints/indexes
create unique index if not exists budget_months_user_month_uidx on public.budget_months(user_id, month);
create unique index if not exists income_history_user_month_uidx on public.income_history(user_id, month);
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists goal_contributions_user_id_idx on public.goal_contributions(user_id);

-- 2) Enable RLS
alter table if exists public.budget_months enable row level security;
alter table if exists public.expenses enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.goals enable row level security;
alter table if exists public.goal_contributions enable row level security;
alter table if exists public.income_history enable row level security;

-- 3) Drop old policies safely (idempotent)
drop policy if exists "budget_months_owner_all" on public.budget_months;
drop policy if exists "expenses_owner_all" on public.expenses;
drop policy if exists "categories_owner_all" on public.categories;
drop policy if exists "goals_owner_all" on public.goals;
drop policy if exists "goal_contributions_owner_all" on public.goal_contributions;
drop policy if exists "income_history_owner_all" on public.income_history;

-- 4) Owner-only policies
create policy "budget_months_owner_all"
on public.budget_months
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "expenses_owner_all"
on public.expenses
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "categories_owner_all"
on public.categories
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "goals_owner_all"
on public.goals
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "goal_contributions_owner_all"
on public.goal_contributions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "income_history_owner_all"
on public.income_history
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 5) Secure RPC used by app to increment goal savings
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
  set saved_cents = saved_cents + p_amount_cents
  where id = p_goal_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.increment_goal_saved_cents(uuid, uuid, integer) from public;
grant execute on function public.increment_goal_saved_cents(uuid, uuid, integer) to authenticated;
