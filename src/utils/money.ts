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

/**
 * Format cents as currency string
 */
export function formatMoney(cents: number, currency: string = 'EUR'): string {
  const euros = centsToEuros(cents);
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

/**
 * Format as compact number (e.g., €1.2K)
 */
export function formatMoneyCompact(cents: number, currency: string = 'EUR'): string {
  const euros = centsToEuros(cents);
  if (euros >= 1000) {
    return `€${(euros / 1000).toFixed(1)}K`;
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
