-- Persist per-month budget plan adjustments (goal reallocation, paused goals, etc.) across devices.

alter table if exists public.user_settings
  add column if not exists month_adjustments jsonb not null default '{}'::jsonb;
