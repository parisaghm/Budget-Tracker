-- Expense inserts could fail RLS when the EXISTS subquery on budget_months is evaluated
-- under the same RLS stack as the INSERT (e.g. visibility quirks). Resolve by using a
-- SECURITY DEFINER helper that checks ownership using auth.uid() while bypassing RLS on
-- the budget_months lookup only for that verification.

create or replace function public.budget_month_owned_by_user(p_budget_month_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.budget_months bm
    where bm.id = p_budget_month_id
      and bm.user_id = auth.uid()
  );
$$;

revoke all on function public.budget_month_owned_by_user(uuid) from public;
grant execute on function public.budget_month_owned_by_user(uuid) to authenticated;

drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;

create policy "expenses_insert_own" on public.expenses for insert to authenticated with check (
  user_id = auth.uid()
  and public.budget_month_owned_by_user(budget_month_id)
);

create policy "expenses_update_own" on public.expenses for update to authenticated using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.budget_month_owned_by_user(budget_month_id)
);
