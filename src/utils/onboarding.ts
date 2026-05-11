import { addMonths, format, parse, startOfDay, startOfMonth } from "date-fns";
import {
  DEFAULT_ONBOARDING_DATA,
  ONBOARDING_CATEGORY_OPTIONS,
  type OnboardingCategory,
  type OnboardingData,
  type OnboardingFixedBill,
} from "@/types/onboarding";

const ALLOWED_ONBOARDING_CATEGORIES = new Set<string>(ONBOARDING_CATEGORY_OPTIONS);

/** Stable name for the goal created from onboarding “monthly savings” so we can upsert from settings. */
export const ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME = "Monthly savings plan";

/** Optional custom category labels to create when the user picks these onboarding categories. */
export const ONBOARDING_CATEGORY_TO_CUSTOM_LABEL: Record<OnboardingCategory, string | null> = {
  groceries: null,
  eating_out: "Eating out",
  transport: "Transport",
  shopping: null,
  entertainment: null,
  other: null,
};

function coerceCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function majorUnitsToCents(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function normalizeFixedBills(raw: unknown): OnboardingFixedBill[] {
  if (!Array.isArray(raw)) return DEFAULT_ONBOARDING_DATA.fixedBills;
  return raw.map((item, index) => {
    const o = item as Record<string, unknown>;
    const id = typeof o?.id === "string" && o.id.length > 0 ? o.id : `onboarding-bill-${index}`;
    const name = typeof o?.name === "string" ? o.name : "";
    const hasAmountCents = o?.amountCents !== undefined && o?.amountCents !== null;
    const amountCents = hasAmountCents ? coerceCents(o?.amountCents) : majorUnitsToCents(o?.amount);
    return { id, name, amountCents };
  });
}

function normalizeCategories(raw: unknown): OnboardingCategory[] {
  if (!Array.isArray(raw)) return DEFAULT_ONBOARDING_DATA.categories;
  const list = raw.filter((c): c is OnboardingCategory => typeof c === "string" && ALLOWED_ONBOARDING_CATEGORIES.has(c));
  return list.length > 0 ? list : DEFAULT_ONBOARDING_DATA.categories;
}

/**
 * Default schedule for onboarding “fixed monthly” bills when the user did not pick a due date.
 * Uses the 1st of the month after the selected budget month (YYYY-MM) when provided, otherwise
 * the month after `reference`, so due dates align with the month selector / salary window.
 */
export function defaultOnboardingRecurringSchedule(
  reference: Date = new Date(),
  budgetMonthYm?: string,
): {
  dueDay: number;
  nextDueDate: string;
} {
  const anchor =
    budgetMonthYm && /^\d{4}-\d{2}$/.test(budgetMonthYm)
      ? parse(`${budgetMonthYm}-01`, "yyyy-MM-dd", new Date())
      : startOfMonth(reference);
  let candidate = addMonths(startOfMonth(anchor), 1);
  const today = startOfDay(reference);
  while (startOfDay(candidate) < today) {
    candidate = addMonths(candidate, 1);
  }
  return {
    dueDay: 1,
    nextDueDate: format(candidate, "yyyy-MM-dd"),
  };
}

export function onboardingFixedBillAlreadyExists(
  recurringBills: Array<{ name: string; amountCents: number }>,
  name: string,
  amountCents: number,
): boolean {
  const n = name.trim().toLowerCase();
  return recurringBills.some(
    (b) => b.name.trim().toLowerCase() === n && b.amountCents === amountCents,
  );
}

export const ONBOARDING_CATEGORY_LABELS: Record<OnboardingCategory, string> = {
  groceries: "Groceries",
  eating_out: "Eating out",
  transport: "Transport",
  shopping: "Shopping",
  entertainment: "Entertainment",
  other: "Other",
};

export interface SafeToSpendResult {
  monthlyIncomeCents: number;
  fixedBillsCents: number;
  savingsCents: number;
  availableMonthlyCents: number;
  weeklyFromMonthlyCents: number;
  recommendedWeeklyCents: number;
}

export function calcSafeToSpend(data: OnboardingData): SafeToSpendResult {
  const fixedBillsCents = data.fixedBills.reduce((sum, bill) => sum + Math.max(0, bill.amountCents), 0);
  const monthlyIncomeCents = Math.max(0, data.monthlyIncomeCents);
  const savingsCents = Math.max(0, data.monthlySavingsGoalCents);
  const availableMonthlyCents = Math.max(0, monthlyIncomeCents - fixedBillsCents - savingsCents);
  const weeklyFromMonthlyCents = Math.max(0, Math.floor(availableMonthlyCents / 4.33));
  const preferred = data.wantsWeeklyBudget ? data.preferredWeeklyBudgetCents ?? weeklyFromMonthlyCents : null;
  const recommendedWeeklyCents =
    preferred == null ? weeklyFromMonthlyCents : Math.min(weeklyFromMonthlyCents, Math.max(0, preferred));

  return {
    monthlyIncomeCents,
    fixedBillsCents,
    savingsCents,
    availableMonthlyCents,
    weeklyFromMonthlyCents,
    recommendedWeeklyCents,
  };
}

export function mergeOnboardingData(partial: Partial<OnboardingData> | null | undefined): OnboardingData {
  if (!partial) return DEFAULT_ONBOARDING_DATA;
  const wantsWeekly =
    typeof partial.wantsWeeklyBudget === "boolean"
      ? partial.wantsWeeklyBudget
      : DEFAULT_ONBOARDING_DATA.wantsWeeklyBudget;
  const preferredRaw = partial.preferredWeeklyBudgetCents;
  const preferredWeeklyBudgetCents =
    preferredRaw === null || preferredRaw === undefined
      ? wantsWeekly
        ? DEFAULT_ONBOARDING_DATA.preferredWeeklyBudgetCents
        : null
      : coerceCents(preferredRaw);

  return {
    ...DEFAULT_ONBOARDING_DATA,
    ...partial,
    monthlyIncomeCents: coerceCents(partial.monthlyIncomeCents ?? DEFAULT_ONBOARDING_DATA.monthlyIncomeCents),
    monthlySavingsGoalCents: coerceCents(
      partial.monthlySavingsGoalCents ?? DEFAULT_ONBOARDING_DATA.monthlySavingsGoalCents,
    ),
    wantsWeeklyBudget: wantsWeekly,
    preferredWeeklyBudgetCents: wantsWeekly ? preferredWeeklyBudgetCents : null,
    fixedBills: normalizeFixedBills(partial.fixedBills),
    categories: normalizeCategories(partial.categories),
    completed: Boolean(partial.completed),
    completedAt:
      partial.completedAt === null || partial.completedAt === undefined
        ? DEFAULT_ONBOARDING_DATA.completedAt
        : String(partial.completedAt),
  };
}
