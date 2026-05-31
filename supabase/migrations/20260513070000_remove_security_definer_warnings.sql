-- Reduce Security Advisor warnings by avoiding SECURITY DEFINER where not required.
-- Both functions rely on existing RLS ownership checks and auth.uid().

create or replace function public.budget_month_owned_by_user(p_budget_month_id uuid)
returns boolean
language sql
stable
security invoker
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

create or replace function public.increment_goal_saved_cents(
  p_goal_id uuid,
  p_user_id uuid,
  p_amount_cents integer
)
returns void
language plpgsql
security invoker
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
