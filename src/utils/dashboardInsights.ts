import type { CategoryDef, Expense, RecurringBill } from "@/types/finance";
import type { FinancialPace } from "@/utils/financialPace";
import { resolveCategoryBudgetStatus } from "@/utils/categoryBudgetStatus";
import { formatMoney, formatMonthNameOnly } from "@/utils/money";
import { getDaysUntil } from "@/utils/recurringBills";

export type DashboardInsightTone = "neutral" | "positive" | "caution";

export interface DashboardInsight {
  id: string;
  message: string;
  tone: DashboardInsightTone;
}

export interface BuildDashboardInsightsInput {
  expenses: Expense[];
  categories: CategoryDef[];
  categoryLimits: Record<string, number>;
  financialPace: FinancialPace;
  upcomingBills: RecurringBill[];
  previousMonthExpenses: Expense[];
  previousMonthKey: string | null;
  monthComparisonLabel: string | null;
  currency?: string;
  today?: Date;
}

function sumByCategory(expenses: Expense[]): Record<string, number> {
  const map: Record<string, number> = {};
  expenses.forEach((exp) => {
    map[exp.category] = (map[exp.category] || 0) + exp.amountCents;
  });
  return map;
}

export function buildDashboardInsights(input: BuildDashboardInsightsInput): DashboardInsight[] {
  const {
    expenses,
    categories,
    categoryLimits,
    financialPace,
    upcomingBills,
    previousMonthExpenses,
    previousMonthKey,
    monthComparisonLabel,
    currency = "EUR",
    today = new Date(),
  } = input;

  const insights: DashboardInsight[] = [];
  const currentByCategory = sumByCategory(expenses);
  const previousByCategory = sumByCategory(previousMonthExpenses);

  if (monthComparisonLabel) {
    insights.push({
      id: "month-comparison",
      message: monthComparisonLabel.replace(/^↑\s*/, "You're spending "),
      tone: "positive",
    });
  }

  let biggestMoMIncrease: { label: string; pct: number } | null = null;
  categories.forEach((cat) => {
    const current = currentByCategory[cat.value] || 0;
    const previous = previousByCategory[cat.value] || 0;
    if (current <= 0 || previous <= 0) return;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct >= 10 && (!biggestMoMIncrease || pct > biggestMoMIncrease.pct)) {
      biggestMoMIncrease = { label: cat.label, pct };
    }
  });

  if (biggestMoMIncrease && previousMonthKey) {
    const prevMonth = formatMonthNameOnly(previousMonthKey);
    insights.push({
      id: "category-mom",
      message: `${biggestMoMIncrease.label} spending is ${biggestMoMIncrease.pct}% higher than ${prevMonth}.`,
      tone: biggestMoMIncrease.pct >= 25 ? "caution" : "neutral",
    });
  }

  const underBudget = categories.find((cat) => {
    const limit = categoryLimits[cat.value];
    const spent = currentByCategory[cat.value] || 0;
    return resolveCategoryBudgetStatus(spent, limit) === "under" && spent > 0;
  });

  if (underBudget) {
    insights.push({
      id: "under-budget",
      message: `You are currently under your ${underBudget.label.toLowerCase()} budget.`,
      tone: "positive",
    });
  }

  const overBudget = categories.find((cat) => {
    const limit = categoryLimits[cat.value];
    const spent = currentByCategory[cat.value] || 0;
    return resolveCategoryBudgetStatus(spent, limit) === "over";
  });

  if (overBudget) {
    insights.push({
      id: "over-budget",
      message: `${overBudget.label} is over its monthly limit.`,
      tone: "caution",
    });
  }

  if (financialPace.projectedBalanceBeforeSalaryCents > 0) {
    insights.push({
      id: "projected-savings",
      message: `At your current pace you may save ${formatMoney(financialPace.projectedBalanceBeforeSalaryCents, currency)} this month.`,
      tone: "positive",
    });
  }

  const nextBill = upcomingBills[0];
  if (nextBill) {
    const days = getDaysUntil(nextBill.nextDueDate, today);
    if (days != null && days >= 0 && days <= 7) {
      insights.push({
        id: "next-bill",
        message:
          days === 0
            ? `Your next major bill, ${nextBill.name}, is due today.`
            : `Your next major bill, ${nextBill.name}, is due in ${days} day${days === 1 ? "" : "s"}.`,
        tone: days <= 3 ? "caution" : "neutral",
      });
    }
  }

  if (financialPace.guidanceHeadline) {
    insights.push({
      id: "pace-guidance",
      message: financialPace.guidanceDetail
        ? `${financialPace.guidanceHeadline} ${financialPace.guidanceDetail}`
        : financialPace.guidanceHeadline,
      tone: financialPace.emotionalTone === "tight" ? "caution" : "neutral",
    });
  }

  const seen = new Set<string>();
  return insights
    .filter((insight) => {
      if (seen.has(insight.message)) return false;
      seen.add(insight.message);
      return true;
    })
    .slice(0, 5);
}
