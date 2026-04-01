-- Custom category metadata used by the app (persist after re-login)
alter table if exists public.categories
  add column if not exists is_custom boolean not null default false;

alter table if exists public.categories
  add column if not exists icon_key text;
