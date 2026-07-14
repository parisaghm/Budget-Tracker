-- Persist per-user finance preferences (income cycle, selected month) across devices.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  income_cycle jsonb,
  selected_month text,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
drop policy if exists "user_settings_delete_own" on public.user_settings;

create policy "user_settings_select_own"
  on public.user_settings for select to authenticated
  using (user_id = auth.uid());

create policy "user_settings_insert_own"
  on public.user_settings for insert to authenticated
  with check (user_id = auth.uid());

create policy "user_settings_update_own"
  on public.user_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_settings_delete_own"
  on public.user_settings for delete to authenticated
  using (user_id = auth.uid());
