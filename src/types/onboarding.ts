export const ONBOARDING_CATEGORY_OPTIONS = [
  "groceries",
  "eating_out",
  "transport",
  "shopping",
  "entertainment",
  "other",
] as const;

export type OnboardingCategory = (typeof ONBOARDING_CATEGORY_OPTIONS)[number];

export interface OnboardingFixedBill {
  id: string;
  name: string;
  amountCents: number;
}

export interface OnboardingData {
  monthlyIncomeCents: number;
  fixedBills: OnboardingFixedBill[];
  monthlySavingsGoalCents: number;
  wantsWeeklyBudget: boolean;
  preferredWeeklyBudgetCents: number | null;
  categories: OnboardingCategory[];
  completed: boolean;
  completedAt: string | null;
}

export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  monthlyIncomeCents: 0,
  fixedBills: [],
  monthlySavingsGoalCents: 0,
  wantsWeeklyBudget: false,
  preferredWeeklyBudgetCents: null,
  categories: ["groceries", "shopping", "other"],
  completed: false,
  completedAt: null,
};
