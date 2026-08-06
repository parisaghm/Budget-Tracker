-- App-wide display currency preference (formatting only; does not rewrite finance rows).

alter table public.user_settings
  add column if not exists display_currency text not null default 'EUR';

-- Supported codes match src/utils/money.ts CURRENCY_PRESETS (picker primary list).
alter table public.user_settings
  drop constraint if exists user_settings_display_currency_check;

alter table public.user_settings
  add constraint user_settings_display_currency_check
  check (
    display_currency in (
      'EUR',
      'USD',
      'GBP',
      'CHF',
      'NOK',
      'SEK',
      'DKK',
      'PLN',
      'CZK',
      'JPY',
      'CAD',
      'AUD',
      'INR'
    )
  );
