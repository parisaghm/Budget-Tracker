/**
 * Convert euros to cents for storage
 */
export function eurosToCents(euros: number): number {
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
 * Format month string for display
 */
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === getTodayDate()) {
    return 'Today';
  }
  if (dateStr === yesterday.toISOString().split('T')[0]) {
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
