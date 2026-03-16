import type { IconKey } from '@/utils/categoryIcons';

export type Category = string;

export interface CategoryDef {
  /**
   * Stable identifier for the category.
   * For now this is the same as `value` to preserve existing behaviour.
   */
  id: string;
  /**
   * Programmatic value used in expenses, filters, etc.
   */
  value: Category;
  /**
   * Human‑readable label shown in the UI.
   */
  label: string;
  /**
   * Icon key used by the UI layer.
   */
  iconKey: IconKey;
  /**
   * Whether this category was created by the user.
   */
  isCustom: boolean;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'groceries', value: 'groceries', label: 'Groceries', iconKey: 'shopping-basket', isCustom: false },
  { id: 'shopping', value: 'shopping', label: 'Shopping', iconKey: 'shopping-cart', isCustom: false },
  { id: 'entertainment', value: 'entertainment', label: 'Entertainment', iconKey: 'party-popper', isCustom: false },
  { id: 'other', value: 'other', label: 'Other', iconKey: 'more-horizontal', isCustom: false },
];

/**
 * Per-month, per-category spending limits (cents).
 * Key: month (YYYY-MM), value: Record<categoryValue, limitCents>
 */
export type CategoryLimitsByMonth = Record<string, Record<string, number>>;

export interface BudgetMonth {
  id: string;
  month: string; // YYYY-MM format
  salaryCents: number;
  currency: string;
  createdAt: string;
  /**
   * Optional note about this month's income (e.g. bonus, raise, reduced hours).
   */
  incomeNote?: string;
}

export interface Expense {
  id: string;
  budgetMonthId: string;
  month: string;
  amountCents: number;
  category: Category;
  date: string;
  note: string;
  createdAt: string;
}

export interface MonthData {
  budget: BudgetMonth | null;
  expenses: Expense[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  /** ISO date string (YYYY-MM-DD) when the goal was created / started */
  startDate: string;
  /** ISO date string (YYYY-MM-DD) target deadline, e.g. end of Dec 2026 → 2026-12-31 */
  targetDate: string;
  createdAt: string;
}

export const getCategoryLabel = (category: Category, customCategories: CategoryDef[] = []): string => {
  const all = [...DEFAULT_CATEGORIES, ...customCategories];
  return all.find(c => c.value === category)?.label || category;
};
