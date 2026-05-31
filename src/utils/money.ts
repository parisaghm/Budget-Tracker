/**
 * Convert euros to cents for storage
 */
export function eurosToCents(euros: number): number {
  if (!Number.isFinite(euros)) return 0;
  return Math.round(euros * 100);
}

/**
 * Convert cents to euros for display
 */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

/** Preset ISO 4217 codes shown in the currency picker (plus "Other"). */
export const CURRENCY_PRESETS = [
  { code: 'EUR', label: 'Euro' },
  { code: 'USD', label: 'US dollar' },
  { code: 'GBP', label: 'British pound' },
  { code: 'CHF', label: 'Swiss franc' },
  { code: 'NOK', label: 'Norwegian krone' },
  { code: 'SEK', label: 'Swedish krona' },
  { code: 'DKK', label: 'Danish krone' },
  { code: 'PLN', label: 'Polish złoty' },
  { code: 'CZK', label: 'Czech koruna' },
  { code: 'JPY', label: 'Japanese yen' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'AUD', label: 'Australian dollar' },
  { code: 'INR', label: 'Indian rupee' },
] as const;

export const CURRENCY_OTHER_VALUE = '__OTHER__';

const PRESET_CODE_SET = new Set(CURRENCY_PRESETS.map((p) => p.code));

export function isPresetCurrency(code: string | undefined | null): boolean {
  if (code == null || typeof code !== 'string') return false;
  return PRESET_CODE_SET.has(code.toUpperCase());
}

/** Normalize user input to a 3-letter ISO 4217 code; invalid input falls back to EUR. */
export function normalizeCurrencyCode(raw: string | undefined | null): string {
  if (raw == null || typeof raw !== 'string') {
    return 'EUR';
  }
  const s = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length === 3) {
    try {
      new Intl.NumberFormat('en', { style: 'currency', currency: s }).format(0);
      return s;
    } catch {
      return 'EUR';
    }
  }
  return 'EUR';
}

/** Short symbol for input prefixes (e.g. $, €). Falls back to the code. */
export function getCurrencySymbol(currency: string | undefined | null): string {
  const code = normalizeCurrencyCode(currency);
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === 'currency')?.value;
    return sym ?? code;
  } catch {
    return code;
  }
}

/**
 * Format cents as currency string
 */
export function formatMoney(cents: number, currency: string | undefined | null = 'EUR'): string {
  const euros = centsToEuros(cents);
  const code = normalizeCurrencyCode(currency ?? 'EUR');
  try {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: code,
    }).format(euros);
  } catch {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR',
    }).format(euros);
  }
}

/**
 * Format as compact number (e.g., €1.2K)
 */
export function formatMoneyCompact(cents: number, currency: string | undefined | null = 'EUR'): string {
  const euros = centsToEuros(cents);
  const sym = getCurrencySymbol(currency ?? 'EUR');
  if (euros >= 1000) {
    return `${sym}${(euros / 1000).toFixed(1)}K`;
  }
  return formatMoney(cents, currency);
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Normalize a month key to strict YYYY-MM (zero-padded month).
 */
export function normalizeYearMonthYm(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return s;
  const mo = Number(m[2]);
  if (!Number.isFinite(mo) || mo < 1 || mo > 12) return s;
  return `${m[1]}-${String(mo).padStart(2, '0')}`;
}

/**
 * Format month string for display
 */
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Month name only, e.g. "April" from "2026-04". */
export function formatMonthNameOnly(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
  return date.toLocaleDateString('en-US', { month: 'long' });
}

/**
 * Get the previous month key for a given month (YYYY-MM), wrapping years.
 */
export function getPreviousMonth(monthStr: string): string {
  const [yearStr, monthStrPart] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStrPart, 10) - 1; // 0-based
  const date = new Date(year, monthIndex, 1);
  date.setMonth(date.getMonth() - 1);
  const prevYear = date.getFullYear();
  const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}

/** YYYY-MM-DD in the user's local calendar (not UTC). */
function localCalendarYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get today's date in YYYY-MM-DD format (local calendar).
 */
export function getTodayDate(): string {
  return localCalendarYmd(new Date());
}

/**
 * Default calendar day for a new expense in a given budget month (YYYY-MM).
 * Uses today when today falls in that month; otherwise the first day of that month
 * so `date` stays aligned with the budget month the user is viewing.
 */
export function defaultExpenseDateForBudgetMonth(budgetMonthYm: string): string {
  const ym = normalizeYearMonthYm(budgetMonthYm);
  const today = getTodayDate();
  if (normalizeYearMonthYm(today.slice(0, 7)) === ym) return today;
  return `${ym}-01`;
}

/**
 * Normalize DB/API date strings for HTML date inputs (value must be YYYY-MM-DD).
 * Handles ISO timestamps and plain dates; returns '' if not a valid calendar day.
 */
export function toDateInputValue(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return '';
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return '';
  const dt = new Date(y, mo - 1, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== day) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const head = dateStr.trim().slice(0, 10);
  const isYmd = /^\d{4}-\d{2}-\d{2}$/.test(head);
  const date = isYmd
    ? new Date(Number(head.slice(0, 4)), Number(head.slice(5, 7)) - 1, Number(head.slice(8, 10)))
    : new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  const dayKey = isYmd ? head : localCalendarYmd(date);
  if (dayKey === getTodayDate()) {
    return 'Today';
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === localCalendarYmd(yesterday)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculate percentage spent
 */
export function calculateSpentPercentage(spentCents: number, salaryCents: number): number {
  if (salaryCents === 0) return 0;
  return Math.min(Math.round((spentCents / salaryCents) * 100), 100);
}
