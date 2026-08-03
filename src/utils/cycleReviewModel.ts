import { parseISO } from "date-fns";
import type { BudgetCycle, IncomeEntry } from "@/types/budgetCycle";
import type {
  CategoryDef,
  Expense,
  RecurringBill,
  SavingsGoal,
  Category,
} from "@/types/finance";
import {
  budgetMonthKeyFromCycle,
  findPreviousCycle,
  isDateInBudgetCycle,
} from "@/utils/budgetCycles";
import { buildBudgetPageModel } from "@/utils/budgetPageModel";
import { buildSpentByCategory } from "@/utils/budgetPlanning";
import { formatIncomeDateLabel } from "@/utils/incomeCycle";
import { resolveAuthoritativeSavingsPlan } from "@/utils/savingsAllocation";
import { computeSafeToSpendCents } from "@/utils/safeToSpend";
import { getCategoryLabel } from "@/types/finance";
import {
  clampPercentDisplay,
  computeCycleDayProgress,
  buildCumulativeSpendingSeries,
  projectCycleSpend,
  sumSpendThroughDay,
  type CumulativeSeries,
  type CycleDayProgress,
  type CycleProjectionResult,
} from "@/utils/cycleProjection";
import {
  computeCycleVerdict,
  type CycleVerdict,
  type CycleVerdictResult,
} from "@/utils/cycleVerdict";

function categoryLabel(value: string, categories: CategoryDef[]): string {
  return getCategoryLabel(
    value as Category,
    categories.filter((c) => c.isCustom),
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type HeroTone = "healthy" | "caution" | "over_plan" | "no_income";

export type PaceStatus =
  | "on_pace"
  | "slightly_ahead"
  | "faster"
  | "no_plan"
  | "no_income";

export interface CycleReconciliation {
  fixedPlusFlexiblePlusNonMonthlyCents: number;
  totalCycleSpendingCents: number;
  segmentsMatchSpent: boolean;
  spentMatchesHome: boolean;
  safeToSpendMatchesHome: boolean;
  moneyFlowExceedsIncome: boolean;
  ok: boolean;
  warnings: string[];
}

export interface MoneyFlowSegment {
  id: "fixed" | "flexible" | "non_monthly" | "savings" | "left_over";
  label: string;
  amountCents: number;
  /** Share of income (raw ratio). */
  incomeRatio: number | null;
  percentOfIncomeDisplay: number | null;
  hint?: string;
  statusNote?: string;
}

export interface MoneyFlowModel {
  incomeReceivedCents: number;
  fixedActualCents: number;
  flexibleActualCents: number;
  nonMonthlyActualCents: number;
  spentTotalCents: number;
  /** Actual contribution ledger sum — not reserved/planned savings. */
  actualContributionsCents: number;
  leftOverCents: number;
  segments: MoneyFlowSegment[];
  spentRows: MoneyFlowSegment[];
  savingsRow: MoneyFlowSegment | null;
  leftOverRow: MoneyFlowSegment | null;
  perTenBreakdown: {
    spentPerTenCents: number;
    savedPerTenCents: number;
    leftPerTenCents: number;
  } | null;
  emptyReason: string | null;
}

export interface PaceModel {
  progress: CycleDayProgress;
  planUsedRatio: number | null;
  planUsedPercentDisplay: number | null;
  actualSpentCents: number;
  plannedExpensesCents: number;
  hasPlannedExpenses: boolean;
  projection: CycleProjectionResult;
  status: PaceStatus;
  statusMessage: string;
  cycleRangeLabel: string;
  cycleStatusLabel: string;
  series: CumulativeSeries;
  explanation: string | null;
}

export interface HeroModel {
  tone: HeroTone;
  label: string;
  heading: string;
  supporting: string | null;
  pills: Array<{
    id: string;
    tone: "healthy" | "caution" | "over_plan" | "info";
    text: string;
  }>;
  recapCta: {
    kind: "play" | "preview";
    buttonLabel: string;
    caption: string;
    completedCycleId: string | null;
  };
}

export interface ComparisonStat {
  id: string;
  label: string;
  valueLabel: string;
  badgeText: string | null;
  badgeTone: "healthy" | "caution" | "over_plan" | "info" | null;
}

export interface ComparisonModel {
  available: boolean;
  emptyReason: string | null;
  helperText: string | null;
  subtitle: string;
  stats: ComparisonStat[];
}

export interface WatchItem {
  id: string;
  priority: number;
  tone: "caution" | "info" | "healthy";
  icon: "utensils" | "file" | "leaf" | "pace" | "wallet";
  /** Title may include already-safe percent text; amounts formatted in UI via titleCents. */
  title: string;
  titleAmountCents?: number;
  explanation: string;
  /** Ordered cents to substitute into explanation as {0}, {1}, … via formatWatchExplanation. */
  explanationCents?: number[];
  actionLabel?: string;
  actionTo?: string;
}

/** Replace `{0}`, `{1}` in explanation with formatted money strings. */
export function formatWatchExplanation(
  item: WatchItem,
  formatMoneyFn: (cents: number) => string,
): string {
  const amounts = item.explanationCents ?? [];
  return item.explanation.replace(/\{(\d+)\}/g, (_, idx) => {
    const n = Number(idx);
    const cents = amounts[n];
    return cents == null ? "" : formatMoneyFn(cents);
  });
}

export interface FinishedCycleSummary {
  cycle: BudgetCycle;
  rangeLabel: string;
  resultLine: string | null;
  verdict: CycleVerdictResult;
  hasPlannedExpenses: boolean;
  hasContributionsData: boolean;
  actualSpentCents: number;
  incomeCents: number;
  actualContributionsCents: number;
  plannedExpensesCents: number | null;
  plannedSavingsCents: number;
}

export type RecapPillTone = "healthy" | "caution" | "tough" | "info";

/** Story-style recap slide — one eyebrow, one headline/number, one short body. */
export interface RecapSlide {
  id: "opening" | "spent" | "biggest_mover" | "savings" | "verdict" | "unavailable";
  eyebrow: string;
  headline: string;
  /** Optional big serif amount (cents); formatted at UI layer. */
  heroAmountCents?: number | null;
  body: string;
  pillLabel?: string;
  pillTone?: RecapPillTone;
  unavailable?: boolean;
}

export interface CompletedCycleRecap {
  cycle: BudgetCycle;
  rangeLabel: string;
  /** False when the cycle has no expenses — do not offer/play. */
  offerable: boolean;
  slides: RecapSlide[];
}

export interface CycleReviewModel {
  selectedCycle: BudgetCycle;
  progress: CycleDayProgress;
  hero: HeroModel;
  moneyFlow: MoneyFlowModel;
  pace: PaceModel;
  comparison: ComparisonModel;
  watchItems: WatchItem[];
  watchTitle: string;
  finishedCycles: FinishedCycleSummary[];
  finishedTotalCount: number;
  reconciliation: CycleReconciliation;
  /** Distinct savings fields */
  plannedSavingsCents: number;
  allocatedToGoalsCents: number;
  actualContributionsCents: number;
  safeToSpendCents: number;
  actualSpentCents: number;
  incomeReceivedCents: number;
  leftToBudgetCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sumCents(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amountCents, 0);
}

function cycleExpenses(all: Expense[], cycle: BudgetCycle): Expense[] {
  return all.filter((e) => isDateInBudgetCycle(e.date, cycle));
}

function formatRange(cycle: BudgetCycle): string {
  return `${formatIncomeDateLabel(parseISO(cycle.startDate))} – ${formatIncomeDateLabel(parseISO(cycle.endDate))}`;
}

function hasAnyCategoryLimits(limits: Record<string, number>): boolean {
  return Object.values(limits).some((v) => v > 0);
}

/**
 * Partition cycle spend into Fixed / Flexible / Non-monthly so
 * fixed + flexible + nonMonthly === totalSpent (authoritative expense sum).
 * Unattributed remainder after bill attribution goes into Flexible.
 */
function partitionActualSpend(params: {
  expenses: Expense[];
  categories: CategoryDef[];
  categoryLimits: Record<string, number>;
  incomeEntries: IncomeEntry[];
  totalIncomeCents: number;
  recurringBills: RecurringBill[];
  upcomingBills: RecurringBill[];
  selectedCycle: BudgetCycle;
  savingsGoals: SavingsGoal[];
  contributionsByGoal: Record<string, number>;
}): {
  fixedActualCents: number;
  flexibleActualCents: number;
  nonMonthlyActualCents: number;
  plannedExpensesCents: number;
  leftToBudgetCents: number;
  budgetModel: ReturnType<typeof buildBudgetPageModel>;
} {
  const { expenses, selectedCycle } = params;
  const totalSpent = sumCents(expenses);
  const budgetModel = buildBudgetPageModel({
    categories: params.categories,
    expenses,
    categoryLimits: params.categoryLimits,
    incomeEntries: params.incomeEntries,
    totalIncomeCents: params.totalIncomeCents,
    recurringBills: params.recurringBills,
    upcomingBills: params.upcomingBills,
    selectedCycle,
    cycleStartIso: selectedCycle.startDate,
    cycleEndIso: selectedCycle.endDate,
    savingsGoals: params.savingsGoals,
    contributionsByGoal: params.contributionsByGoal,
    formatMoneyFn: () => "",
  });

  const fixedActualCents = budgetModel.fixed.actualCents;
  const nonMonthlyActualCents = budgetModel.nonMonthly.actualCents;
  const attributed = fixedActualCents + nonMonthlyActualCents;
  const flexibleActualCents = Math.max(0, totalSpent - attributed);

  return {
    fixedActualCents,
    flexibleActualCents,
    nonMonthlyActualCents,
    plannedExpensesCents: budgetModel.expensesTotals.plannedCents,
    leftToBudgetCents: budgetModel.leftToBudgetCents,
    budgetModel,
  };
}

function buildMoneyFlow(params: {
  incomeReceivedCents: number;
  fixedActualCents: number;
  flexibleActualCents: number;
  nonMonthlyActualCents: number;
  actualContributionsCents: number;
  plannedSavingsCents: number;
}): MoneyFlowModel {
  const {
    incomeReceivedCents,
    fixedActualCents,
    flexibleActualCents,
    nonMonthlyActualCents,
    actualContributionsCents,
    plannedSavingsCents,
  } = params;

  const spentTotalCents =
    fixedActualCents + flexibleActualCents + nonMonthlyActualCents;
  const leftOverCents =
    incomeReceivedCents - spentTotalCents - actualContributionsCents;

  if (incomeReceivedCents <= 0) {
    return {
      incomeReceivedCents,
      fixedActualCents,
      flexibleActualCents,
      nonMonthlyActualCents,
      spentTotalCents,
      actualContributionsCents,
      leftOverCents,
      segments: [],
      spentRows: [],
      savingsRow: null,
      leftOverRow: null,
      perTenBreakdown: null,
      emptyReason: "No income recorded for this cycle.",
    };
  }

  const ratio = (amount: number) => amount / incomeReceivedCents;
  const pct = (amount: number) => clampPercentDisplay(ratio(amount));

  const spentRows: MoneyFlowSegment[] = [
    {
      id: "fixed",
      label: "Fixed",
      amountCents: fixedActualCents,
      incomeRatio: ratio(fixedActualCents),
      percentOfIncomeDisplay: pct(fixedActualCents),
    },
    {
      id: "flexible",
      label: "Flexible",
      amountCents: flexibleActualCents,
      incomeRatio: ratio(flexibleActualCents),
      percentOfIncomeDisplay: pct(flexibleActualCents),
    },
    {
      id: "non_monthly",
      label: "Non-monthly",
      amountCents: nonMonthlyActualCents,
      incomeRatio: ratio(nonMonthlyActualCents),
      percentOfIncomeDisplay: pct(nonMonthlyActualCents),
    },
  ];

  const savingsFullyKept =
    plannedSavingsCents > 0 && actualContributionsCents >= plannedSavingsCents;
  const savingsRow: MoneyFlowSegment = {
    id: "savings",
    label: "Savings goals",
    amountCents: actualContributionsCents,
    incomeRatio: ratio(actualContributionsCents),
    percentOfIncomeDisplay: pct(actualContributionsCents),
    statusNote:
      actualContributionsCents <= 0
        ? plannedSavingsCents > 0
          ? "plan reserved, no contributions yet"
          : "no contributions"
        : savingsFullyKept
          ? "full plan kept ✓"
          : undefined,
  };

  const leftOverRow: MoneyFlowSegment = {
    id: "left_over",
    label: "Left over",
    amountCents: leftOverCents,
    incomeRatio: ratio(leftOverCents),
    percentOfIncomeDisplay: pct(leftOverCents),
    hint: "your quiet surplus",
  };

  const segments: MoneyFlowSegment[] = [
    ...spentRows,
    savingsRow,
    leftOverRow,
  ].filter((s) => s.amountCents !== 0 || s.id === "left_over" || s.id === "savings");

  const perTen = (part: number) =>
    Math.round((10_00 * part) / incomeReceivedCents);

  return {
    incomeReceivedCents,
    fixedActualCents,
    flexibleActualCents,
    nonMonthlyActualCents,
    spentTotalCents,
    actualContributionsCents,
    leftOverCents,
    segments,
    spentRows,
    savingsRow,
    leftOverRow,
    perTenBreakdown: {
      spentPerTenCents: perTen(spentTotalCents),
      savedPerTenCents: perTen(actualContributionsCents),
      leftPerTenCents: perTen(Math.max(0, leftOverCents)),
    },
    emptyReason: null,
  };
}

function paceStatus(
  planUsedRatio: number | null,
  elapsedRatio: number,
  hasPlan: boolean,
  hasIncome: boolean,
): { status: PaceStatus; message: string } {
  if (!hasIncome) {
    return {
      status: "no_income",
      message: "Add your income to review this cycle.",
    };
  }
  if (!hasPlan || planUsedRatio == null) {
    return {
      status: "no_plan",
      message: "Add category budgets to calculate your pace.",
    };
  }
  const delta = planUsedRatio - elapsedRatio;
  if (delta <= 0.02) {
    return {
      status: "on_pace",
      message: "Money is moving slower than time — you’re on pace.",
    };
  }
  if (delta <= 0.08) {
    return {
      status: "slightly_ahead",
      message: "You’re slightly ahead of pace.",
    };
  }
  return {
    status: "faster",
    message: "Spending is moving faster than your plan.",
  };
}

function heroToneFrom(params: {
  hasIncome: boolean;
  safeToSpendCents: number;
  paceStatus: PaceStatus;
  planUsedRatio: number | null;
  elapsedRatio: number;
}): HeroTone {
  if (!params.hasIncome) return "no_income";
  if (params.safeToSpendCents < 0) return "caution";
  if (
    params.paceStatus === "faster" ||
    (params.planUsedRatio != null && params.planUsedRatio > 1)
  ) {
    return "over_plan";
  }
  if (params.paceStatus === "slightly_ahead" || params.safeToSpendCents === 0) {
    return "caution";
  }
  return "healthy";
}

function heroHeading(tone: HeroTone): string {
  switch (tone) {
    case "healthy":
      return "You’re spending calmly this cycle.";
    case "caution":
      return "This cycle needs a little attention.";
    case "over_plan":
      return "You’re moving faster than your plan.";
    case "no_income":
      return "Add your income to review this cycle.";
  }
}

// ─── Public builders ─────────────────────────────────────────────────────────

export interface BuildCycleReviewModelInput {
  selectedCycle: BudgetCycle;
  budgetCycles: BudgetCycle[];
  /** Authoritative Home spent for selected cycle. */
  homeSpentCents: number;
  /** Authoritative Home Safe to Spend. */
  homeSafeToSpendCents: number;
  todayYmd: string;
  incomeReceivedCents: number;
  incomeEntries: IncomeEntry[];
  /** Expenses already filtered to selectedCycle (or will be re-filtered). */
  cycleExpensesList: Expense[];
  allExpenses: Expense[];
  categories: CategoryDef[];
  categoryLimits: Record<string, number>;
  recurringBills: RecurringBill[];
  upcomingBills: RecurringBill[];
  savingsGoals: SavingsGoal[];
  /** Distinct savings fields */
  plannedSavingsCents: number;
  allocatedToGoalsCents: number;
  contributionsByGoal: Record<string, number>;
  /**
   * Historical: contributions total per closed cycle id.
   * Only include cycles where ledger data was fetched.
   */
  contributionsByCycleId: Record<string, number>;
  /**
   * Historical: income total per closed cycle id.
   */
  incomeByCycleId: Record<string, number>;
  /**
   * Category limits by month key for historical finished-cycle plan checks.
   * Do not pass current limits under another cycle's month unless that month's
   * limits actually exist in storage.
   */
  categoryLimitsByMonth: Record<string, Record<string, number>>;
  currency?: string;
  finishedListLimit?: number;
}

export function buildCycleReviewModel(
  input: BuildCycleReviewModelInput,
): CycleReviewModel {
  const {
    selectedCycle,
    budgetCycles,
    homeSpentCents,
    homeSafeToSpendCents,
    todayYmd,
    incomeReceivedCents,
    incomeEntries,
    categories,
    categoryLimits,
    recurringBills,
    upcomingBills,
    savingsGoals,
    plannedSavingsCents,
    allocatedToGoalsCents,
    contributionsByGoal,
    contributionsByCycleId,
    incomeByCycleId,
    categoryLimitsByMonth,
    finishedListLimit = 5,
  } = input;

  const expenses = cycleExpenses(input.cycleExpensesList, selectedCycle);
  const actualSpentCents = sumCents(expenses);
  const actualContributionsCents = Object.values(contributionsByGoal).reduce(
    (s, v) => s + Math.max(0, v),
    0,
  );

  const progress = computeCycleDayProgress(selectedCycle, todayYmd);
  const partition = partitionActualSpend({
    expenses,
    categories,
    categoryLimits,
    incomeEntries,
    totalIncomeCents: incomeReceivedCents,
    recurringBills,
    upcomingBills,
    selectedCycle,
    savingsGoals,
    contributionsByGoal,
  });

  const moneyFlow = buildMoneyFlow({
    incomeReceivedCents,
    fixedActualCents: partition.fixedActualCents,
    flexibleActualCents: partition.flexibleActualCents,
    nonMonthlyActualCents: partition.nonMonthlyActualCents,
    actualContributionsCents,
    plannedSavingsCents,
  });

  const hasPlannedExpenses = partition.plannedExpensesCents > 0;
  const planUsedRatio = hasPlannedExpenses
    ? actualSpentCents / partition.plannedExpensesCents
    : null;
  const planUsedPercentDisplay = clampPercentDisplay(planUsedRatio);

  const projection = projectCycleSpend({
    actualSpentCents,
    elapsedDays: progress.elapsedDays,
    cycleLength: progress.cycleLength,
  });

  const { status, message } = paceStatus(
    planUsedRatio,
    progress.elapsedRatio,
    hasPlannedExpenses,
    incomeReceivedCents > 0,
  );

  const series = buildCumulativeSpendingSeries({
    cycle: selectedCycle,
    expenses,
    todayYmd,
    projection,
  });

  const rangeLabel = formatRange(selectedCycle);
  const cycleStatusLabel =
    selectedCycle.status === "closed"
      ? "closed"
      : selectedCycle.status === "scheduled"
        ? "scheduled"
        : "in progress";

  let explanation: string | null = null;
  if (projection.projectedSpendCents != null && hasPlannedExpenses) {
    const delta = partition.plannedExpensesCents - projection.projectedSpendCents;
    const underOver =
      delta >= 0
        ? `about ${Math.abs(delta)} cents under plan`
        : `about ${Math.abs(delta)} cents over plan`;
    // Explanation amounts are formatted at UI layer; keep cents marker for UI.
    explanation = `__PROJECTED__${projection.projectedSpendCents}__DELTA__${delta}__KIND__${projection.kind}`;
    void underOver;
  } else if (projection.kind === "none" && progress.elapsedDays <= 1) {
    explanation =
      "Projection will become more useful after a few days of spending.";
  }

  // Prefer structured explanation fields for UI:
  const pace: PaceModel = {
    progress,
    planUsedRatio,
    planUsedPercentDisplay,
    actualSpentCents,
    plannedExpensesCents: partition.plannedExpensesCents,
    hasPlannedExpenses,
    projection,
    status,
    statusMessage: message,
    cycleRangeLabel: rangeLabel,
    cycleStatusLabel,
    series,
    explanation,
  };

  const tone = heroToneFrom({
    hasIncome: incomeReceivedCents > 0,
    safeToSpendCents: homeSafeToSpendCents,
    paceStatus: status,
    planUsedRatio,
    elapsedRatio: progress.elapsedRatio,
  });

  const pills: HeroModel["pills"] = [];
  if (incomeReceivedCents > 0) {
    if (hasPlannedExpenses && planUsedPercentDisplay != null) {
      const paceOk = status === "on_pace";
      pills.push({
        id: "pace",
        tone: paceOk ? "healthy" : status === "faster" ? "over_plan" : "caution",
        text: `${paceOk ? "✓ On pace" : status === "faster" ? "Ahead of plan" : "Slightly ahead"} · ${planUsedPercentDisplay}% of plan, ${progress.elapsedPercentDisplay}% of cycle gone`,
      });
    }
    if (homeSafeToSpendCents >= 0 && progress.remainingDays > 0) {
      pills.push({
        id: "buffer",
        tone: "info",
        text: `Buffer: Safe to Spend covers all ${progress.remainingDays} remaining days`,
      });
    } else if (homeSafeToSpendCents < 0) {
      pills.push({
        id: "buffer",
        tone: "caution",
        text: "This cycle needs attention.",
      });
    }
  }

  const closedCycles = budgetCycles
    .filter((c) => c.status === "closed")
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const mostRecentCompleted =
    closedCycles.find((c) => sumCents(cycleExpenses(input.allExpenses, c)) > 0) ??
    null;

  const hero: HeroModel = {
    tone,
    label: `CYCLE REVIEW · DAY ${progress.cycleDay} OF ${progress.cycleLength}`,
    heading: heroHeading(tone),
    supporting:
      incomeReceivedCents <= 0
        ? null
        : `__SUPPORTING__`, // UI formats from model fields
    pills,
    recapCta: mostRecentCompleted
      ? {
          kind: "play",
          buttonLabel: "Play cycle recap",
          caption: `${formatRange(mostRecentCompleted)} · your last finished cycle, in 5 short cards`,
          completedCycleId: mostRecentCompleted.id,
        }
      : {
          kind: "preview",
          buttonLabel: "Preview cycle recap",
          caption:
            "Your first full recap will be available when this cycle ends.",
          completedCycleId: null,
        },
  };

  // Comparison (like-for-like)
  const previous = findPreviousCycle(budgetCycles, selectedCycle);
  const previousClosed =
    previous && previous.status === "closed" ? previous : null;
  let comparison: ComparisonModel = {
    available: false,
    emptyReason:
      "Cycle comparisons will appear after your first completed cycle.",
    helperText: null,
    subtitle:
      "Compared at the same point in each cycle, so a half-finished cycle is never measured against a whole one.",
    stats: [],
  };

  if (previousClosed && progress.cycleDay > 0) {
    const prevExpenses = cycleExpenses(input.allExpenses, previousClosed);
    const dayX = progress.cycleDay;
    const spentNow = sumSpendThroughDay(selectedCycle, expenses, dayX);
    const spentPrev = sumSpendThroughDay(previousClosed, prevExpenses, dayX);
    const delta = spentNow - spentPrev;

    const spentByCat = buildSpentByCategory(expenses);
    let watchCat: ComparisonStat | null = null;
    let bestScore = -1;
    for (const cat of categories) {
      const limit = categoryLimits[cat.value] ?? 0;
      const spent = spentByCat[cat.value] ?? 0;
      if (limit <= 0 && spent <= 0) continue;
      const ratio = limit > 0 ? spent / limit : 0;
      const score = limit > 0 ? ratio : spent / Math.max(actualSpentCents, 1);
      if (score > bestScore) {
        bestScore = score;
        const pct = limit > 0 ? Math.round(ratio * 100) : null;
        watchCat = {
          id: "watch_category",
          label: categoryLabel(cat.value, categories),
          valueLabel: `__CENTS__${spent}`,
          badgeText:
            pct != null ? `already ${pct}% of plan` : "notable spend",
          badgeTone:
            pct != null && pct >= 85
              ? "caution"
              : pct != null && pct > 100
                ? "over_plan"
                : "info",
        };
      }
    }

    const lastThree = closedCycles.slice(0, 3);
    let hit = 0;
    let counted = 0;
    for (const c of lastThree) {
      if (!(c.id in contributionsByCycleId)) continue;
      counted += 1;
      const contrib = contributionsByCycleId[c.id] ?? 0;
      if (plannedSavingsCents > 0 && contrib >= plannedSavingsCents) hit += 1;
      else if (plannedSavingsCents <= 0 && contrib > 0) hit += 1;
    }

    comparison = {
      available: true,
      emptyReason: null,
      helperText: `day ${dayX} vs day ${dayX} · like for like`,
      subtitle:
        "Compared at the same point in each cycle, so a half-finished cycle is never measured against a whole one.",
      stats: [
        {
          id: "spent",
          label: `Spent by day ${dayX}`,
          valueLabel: `__CENTS__${spentNow}`,
          badgeText:
            delta === 0
              ? "same as last cycle"
              : delta < 0
                ? `__DELTA__${delta} vs last cycle`
                : `__DELTA__+${delta} vs last cycle`,
          badgeTone: delta <= 0 ? "healthy" : "caution",
        },
        watchCat ?? {
          id: "watch_category",
          label: "Categories",
          valueLabel: "—",
          badgeText: "No category spend yet",
          badgeTone: "info",
        },
        {
          id: "savings_kept",
          label: "Savings kept",
          valueLabel: counted > 0 ? `${hit} of ${counted}` : "—",
          badgeText:
            counted > 0
              ? "cycles hit the full plan"
              : "Contribution history not available yet",
          badgeTone: "info",
        },
      ],
    };
  }

  // Watch items
  const watchItems = buildWatchItems({
    expenses,
    categories,
    categoryLimits,
    upcomingBills,
    plannedSavingsCents,
    actualContributionsCents,
    allocatedToGoalsCents,
    progress,
    paceStatus: status,
    leftToBudgetCents: partition.leftToBudgetCents,
    selectedCycle,
  });

  // Finished cycles
  const finishedAll = closedCycles.map((cycle) =>
    summarizeFinishedCycle({
      cycle,
      allExpenses: input.allExpenses,
      contributionsByCycleId,
      incomeByCycleId,
      categoryLimitsByMonth,
      plannedSavingsCents,
      categories,
      recurringBills,
    }),
  );

  const reconciliation = buildReconciliation({
    fixedActualCents: partition.fixedActualCents,
    flexibleActualCents: partition.flexibleActualCents,
    nonMonthlyActualCents: partition.nonMonthlyActualCents,
    totalCycleSpendingCents: actualSpentCents,
    homeSpentCents,
    homeSafeToSpendCents,
    modelSafeToSpendCents: homeSafeToSpendCents,
    incomeReceivedCents,
    moneyFlow,
  });

  if (!reconciliation.ok) {
    for (const w of reconciliation.warnings) {
      console.warn(`[CycleReview] reconciliation: ${w}`);
    }
  }

  return {
    selectedCycle,
    progress,
    hero,
    moneyFlow,
    pace,
    comparison,
    watchItems,
    watchTitle: `What to watch before ${formatIncomeDateLabel(parseISO(selectedCycle.endDate))}`,
    finishedCycles: finishedAll.slice(0, finishedListLimit),
    finishedTotalCount: finishedAll.length,
    reconciliation,
    plannedSavingsCents,
    allocatedToGoalsCents,
    actualContributionsCents,
    safeToSpendCents: homeSafeToSpendCents,
    actualSpentCents: reconciliation.segmentsMatchSpent
      ? actualSpentCents
      : homeSpentCents,
    incomeReceivedCents,
    leftToBudgetCents: partition.leftToBudgetCents,
  };
}

function buildReconciliation(params: {
  fixedActualCents: number;
  flexibleActualCents: number;
  nonMonthlyActualCents: number;
  totalCycleSpendingCents: number;
  homeSpentCents: number;
  homeSafeToSpendCents: number;
  modelSafeToSpendCents: number;
  incomeReceivedCents: number;
  moneyFlow: MoneyFlowModel;
}): CycleReconciliation {
  const segmentSum =
    params.fixedActualCents +
    params.flexibleActualCents +
    params.nonMonthlyActualCents;
  const segmentsMatchSpent = segmentSum === params.totalCycleSpendingCents;
  const spentMatchesHome =
    params.totalCycleSpendingCents === params.homeSpentCents;
  const safeToSpendMatchesHome =
    params.modelSafeToSpendCents === params.homeSafeToSpendCents;
  const flowTotal =
    params.moneyFlow.spentTotalCents +
    params.moneyFlow.actualContributionsCents;
  const moneyFlowExceedsIncome =
    params.incomeReceivedCents > 0 && flowTotal > params.incomeReceivedCents + 1;

  const warnings: string[] = [];
  if (!segmentsMatchSpent) {
    warnings.push(
      `segments ${segmentSum} ≠ spent ${params.totalCycleSpendingCents}`,
    );
  }
  if (!spentMatchesHome) {
    warnings.push(
      `cycle spent ${params.totalCycleSpendingCents} ≠ home spent ${params.homeSpentCents}`,
    );
  }
  if (!safeToSpendMatchesHome) {
    warnings.push(`STS mismatch`);
  }
  if (moneyFlowExceedsIncome) {
    warnings.push(`money-flow parts exceed income (possible double-count)`);
  }

  return {
    fixedPlusFlexiblePlusNonMonthlyCents: segmentSum,
    totalCycleSpendingCents: params.totalCycleSpendingCents,
    segmentsMatchSpent,
    spentMatchesHome,
    safeToSpendMatchesHome,
    moneyFlowExceedsIncome,
    ok:
      segmentsMatchSpent &&
      spentMatchesHome &&
      safeToSpendMatchesHome &&
      !moneyFlowExceedsIncome,
    warnings,
  };
}

function buildWatchItems(params: {
  expenses: Expense[];
  categories: CategoryDef[];
  categoryLimits: Record<string, number>;
  upcomingBills: RecurringBill[];
  plannedSavingsCents: number;
  actualContributionsCents: number;
  allocatedToGoalsCents: number;
  progress: CycleDayProgress;
  paceStatus: PaceStatus;
  leftToBudgetCents: number;
  selectedCycle: BudgetCycle;
}): WatchItem[] {
  const items: WatchItem[] = [];
  const spentByCat = buildSpentByCategory(params.expenses);

  // 1. Near / over category
  let bestCat: {
    value: string;
    spent: number;
    limit: number;
    ratio: number;
  } | null = null;
  for (const cat of params.categories) {
    const limit = params.categoryLimits[cat.value] ?? 0;
    if (limit <= 0) continue;
    const spent = spentByCat[cat.value] ?? 0;
    const ratio = spent / limit;
    if (ratio >= 0.85) {
      if (!bestCat || ratio > bestCat.ratio) {
        bestCat = { value: cat.value, spent, limit, ratio };
      }
    }
  }
  if (bestCat) {
    const remaining = Math.max(0, bestCat.limit - bestCat.spent);
    const label = categoryLabel(bestCat.value, params.categories);
    items.push({
      id: `cat-${bestCat.value}`,
      priority: 1,
      tone: "caution",
      icon: "utensils",
      title: `${label} is at ${Math.round(bestCat.ratio * 100)}% of its plan`,
      explanation: `Only {0} left of the {1} plan, with ${params.progress.remainingDays} days to go. Review recent ${label.toLowerCase()} spending.`,
      explanationCents: [remaining, bestCat.limit],
      actionLabel: "Review category",
      actionTo: "/budget",
    });
  }

  // 2. Bills due before cycle end
  const bills = params.upcomingBills.filter((b) => {
    const due = b.nextDueDate?.slice(0, 10);
    if (!due) return false;
    return isDateInBudgetCycle(due, params.selectedCycle);
  });
  if (bills.length > 0) {
    const total = bills.reduce((s, b) => s + b.amountCents, 0);
    const billCents: number[] = [total];
    const nameParts: string[] = [];
    bills.slice(0, 3).forEach((b, i) => {
      billCents.push(b.amountCents);
      const due = b.nextDueDate
        ? formatIncomeDateLabel(parseISO(b.nextDueDate))
        : "";
      nameParts.push(`${b.name} {${i + 1}} (${due})`);
    });
    items.push({
      id: "bills",
      priority: 2,
      tone: "info",
      icon: "file",
      title: `{0} in bills before the cycle ends`,
      titleAmountCents: total,
      explanation: `${nameParts.join(" + ")}. Already reserved in Safe to Spend.`,
      explanationCents: billCents,
      actionLabel: "View bills",
      actionTo: "/bills",
    });
  }

  // 3. Savings
  if (params.plannedSavingsCents > 0) {
    if (params.actualContributionsCents >= params.plannedSavingsCents) {
      items.push({
        id: "savings-safe",
        priority: 3,
        tone: "healthy",
        icon: "leaf",
        title: "Savings goals are on track",
        explanation: `{0} contributed toward the {1} plan.`,
        explanationCents: [
          params.actualContributionsCents,
          params.plannedSavingsCents,
        ],
        actionLabel: "Review savings",
        actionTo: "/goals",
      });
    } else if (
      params.allocatedToGoalsCents >= params.plannedSavingsCents &&
      params.actualContributionsCents < params.plannedSavingsCents
    ) {
      items.push({
        id: "savings-reserved",
        priority: 3,
        tone: "healthy",
        icon: "leaf",
        title: "Savings plan is reserved",
        explanation: `{0} is reserved. Contributions so far: {1}.`,
        explanationCents: [
          params.plannedSavingsCents,
          params.actualContributionsCents,
        ],
        actionLabel: "Review savings",
        actionTo: "/goals",
      });
    } else if (params.progress.elapsedRatio > 0.5) {
      items.push({
        id: "savings-risk",
        priority: 3,
        tone: "caution",
        icon: "leaf",
        title: "Savings plan needs a look",
        explanation: `{0} contributed of {1} planned.`,
        explanationCents: [
          params.actualContributionsCents,
          params.plannedSavingsCents,
        ],
        actionLabel: "Review savings",
        actionTo: "/goals",
      });
    }
  }

  // 4. Pace
  if (params.paceStatus === "faster") {
    items.push({
      id: "pace",
      priority: 4,
      tone: "caution",
      icon: "pace",
      title: "Spending is ahead of elapsed time",
      explanation: "Review recent expenses to see where the pace picked up.",
      actionLabel: "Review expenses",
      actionTo: "/expenses",
    });
  }

  // 5. Unassigned budget
  if (params.leftToBudgetCents > 0) {
    items.push({
      id: "unassigned",
      priority: 5,
      tone: "info",
      icon: "wallet",
      title: "Unassigned budget money remains",
      explanation: `{0} still left to budget this cycle.`,
      explanationCents: [params.leftToBudgetCents],
      actionLabel: "Assign money",
      actionTo: "/budget",
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

function summarizeFinishedCycle(params: {
  cycle: BudgetCycle;
  allExpenses: Expense[];
  contributionsByCycleId: Record<string, number>;
  incomeByCycleId: Record<string, number>;
  categoryLimitsByMonth: Record<string, Record<string, number>>;
  plannedSavingsCents: number;
  categories: CategoryDef[];
  recurringBills: RecurringBill[];
}): FinishedCycleSummary {
  const { cycle } = params;
  const expenses = cycleExpenses(params.allExpenses, cycle);
  const actualSpentCents = sumCents(expenses);
  const monthKey = budgetMonthKeyFromCycle(cycle);
  const limits = params.categoryLimitsByMonth[monthKey];
  const hasPlannedExpenses = limits != null && hasAnyCategoryLimits(limits);
  const hasContributionsData = cycle.id in params.contributionsByCycleId;
  const actualContributionsCents = hasContributionsData
    ? params.contributionsByCycleId[cycle.id] ?? 0
    : 0;
  const incomeCents = params.incomeByCycleId[cycle.id] ?? 0;

  let plannedExpensesCents: number | null = null;
  if (hasPlannedExpenses && limits) {
    // Sum category limits only — do not invent bill plans from current definitions
    // for historical cycles (safeguard: no reconstruct from current settings).
    plannedExpensesCents = Object.values(limits).reduce(
      (s, v) => s + Math.max(0, v),
      0,
    );
  }

  const verdict = computeCycleVerdict({
    actualSpentCents,
    plannedExpensesCents,
    plannedSavingsCents: params.plannedSavingsCents,
    actualContributionsCents: hasContributionsData
      ? actualContributionsCents
      : 0,
    hasPlannedExpenses: hasPlannedExpenses && plannedExpensesCents != null,
  });

  let resultLine: string | null = null;
  if (hasPlannedExpenses && plannedExpensesCents != null) {
    const delta = plannedExpensesCents - actualSpentCents;
    const spendPart =
      delta >= 0
        ? `__UNDER__${delta}`
        : `__OVER__${-delta}`;
    if (hasContributionsData) {
      if (
        params.plannedSavingsCents > 0 &&
        actualContributionsCents >= params.plannedSavingsCents
      ) {
        resultLine = `${spendPart} · saved __CENTS__${actualContributionsCents}`;
      } else if (params.plannedSavingsCents > 0) {
        resultLine = `${spendPart} · saved __CENTS__${actualContributionsCents} of __CENTS__${params.plannedSavingsCents}`;
      } else {
        resultLine = spendPart;
      }
    } else {
      resultLine = `${spendPart} · contribution history not preserved`;
    }
  } else if (hasContributionsData) {
    resultLine = `Spent __CENTS__${actualSpentCents} · saved __CENTS__${actualContributionsCents}`;
  } else {
    resultLine = "Historical plan details were not preserved.";
  }

  return {
    cycle,
    rangeLabel: formatRange(cycle),
    resultLine,
    verdict,
    hasPlannedExpenses,
    hasContributionsData,
    actualSpentCents,
    incomeCents,
    actualContributionsCents,
    plannedExpensesCents,
    plannedSavingsCents: params.plannedSavingsCents,
  };
}

/**
 * Build story recap slides for a **completed** frozen cycle only.
 * Must not receive or fall back to current-cycle aggregates.
 * Returns offerable:false when there are no expenses (nothing to recap).
 */
export function buildCompletedCycleRecap(params: {
  cycle: BudgetCycle;
  expenses: Expense[];
  incomeCents: number;
  incomeEntries: IncomeEntry[];
  actualContributionsCents: number;
  plannedSavingsCents: number;
  hasContributionsData: boolean;
  categoryLimits: Record<string, number> | null;
  categories: CategoryDef[];
  /** True when this is the user's first ever closed cycle. */
  isFirstFinishedCycle?: boolean;
}): CompletedCycleRecap {
  const { cycle } = params;
  const rangeLabel = formatRange(cycle);

  if (cycle.status !== "closed") {
    return {
      cycle,
      rangeLabel,
      offerable: false,
      slides: [
        {
          id: "unavailable",
          eyebrow: "CYCLE RECAP",
          headline: "Recap unavailable",
          body: "Recaps are only available for finished cycles.",
          unavailable: true,
        },
      ],
    };
  }

  const expenses = cycleExpenses(params.expenses, cycle);
  const actualSpent = sumCents(expenses);

  if (actualSpent <= 0) {
    return {
      cycle,
      rangeLabel,
      offerable: false,
      slides: [
        {
          id: "unavailable",
          eyebrow: "CYCLE RECAP",
          headline: "Nothing to recap yet",
          body: "This cycle has no expenses logged, so there’s no story to tell.",
          unavailable: true,
        },
      ],
    };
  }

  const hasPlan =
    params.categoryLimits != null && hasAnyCategoryLimits(params.categoryLimits);
  const plannedExpenses = hasPlan
    ? Object.values(params.categoryLimits!).reduce((s, v) => s + Math.max(0, v), 0)
    : null;

  const contrib = params.hasContributionsData
    ? params.actualContributionsCents
    : 0;
  const plannedSavings = params.plannedSavingsCents;

  const verdict = computeCycleVerdict({
    actualSpentCents: actualSpent,
    plannedExpensesCents: plannedExpenses,
    plannedSavingsCents: plannedSavings,
    actualContributionsCents: contrib,
    hasPlannedExpenses: hasPlan,
  });

  const mover = findBiggestMover({
    expenses,
    categoryLimits: params.categoryLimits,
    categories: params.categories,
  });

  const leftOverCents =
    params.incomeCents - actualSpent - contrib;
  const savingsKept =
    plannedSavings > 0 ? contrib >= plannedSavings : contrib > 0;

  const slides: RecapSlide[] = [
    {
      id: "opening",
      eyebrow: "CYCLE RECAP",
      headline: `Your ${rangeLabel} cycle`,
      body: "Let's look back at how it went — five cards, thirty seconds.",
    },
    buildSpentSlide({
      actualSpent,
      plannedExpenses,
      hasPlan,
    }),
    buildBiggestMoverSlide(mover),
    buildSavingsSlide({
      plannedSavingsCents: plannedSavings,
      actualContributionsCents: contrib,
      hasContributionsData: params.hasContributionsData,
      savingsKept,
      leftOverCents,
    }),
    buildVerdictSlide({
      verdict,
      moverLabel: mover?.label ?? null,
      isFirstFinishedCycle: params.isFirstFinishedCycle === true,
    }),
  ];

  return {
    cycle,
    rangeLabel,
    offerable: true,
    slides,
  };
}

function buildSpentSlide(params: {
  actualSpent: number;
  plannedExpenses: number | null;
  hasPlan: boolean;
}): RecapSlide {
  const { actualSpent, plannedExpenses, hasPlan } = params;
  let body: string;
  if (!hasPlan || plannedExpenses == null || plannedExpenses <= 0) {
    body = "Historical category budgets were not preserved for a plan comparison.";
  } else if (actualSpent <= plannedExpenses) {
    const under = plannedExpenses - actualSpent;
    body = `That's __UNDER__${under} under your __PLAN__${plannedExpenses} plan. Calm cycle.`;
  } else {
    const over = actualSpent - plannedExpenses;
    body = `That's __OVER__${over} over your __PLAN__${plannedExpenses} plan. It happens — let's see where.`;
  }
  return {
    id: "spent",
    eyebrow: "YOU SPENT",
    headline: "",
    heroAmountCents: actualSpent,
    body,
  };
}

interface BiggestMover {
  value: string;
  label: string;
  actualCents: number;
  plannedCents: number;
  deviationCents: number;
}

function findBiggestMover(params: {
  expenses: Expense[];
  categoryLimits: Record<string, number> | null;
  categories: CategoryDef[];
}): BiggestMover | null {
  const spentByCat = buildSpentByCategory(params.expenses);
  const limits = params.categoryLimits ?? {};
  let best: BiggestMover | null = null;

  const values = new Set([
    ...Object.keys(spentByCat),
    ...Object.keys(limits),
  ]);

  for (const value of values) {
    const actual = spentByCat[value] ?? 0;
    const planned = limits[value] ?? 0;
    if (actual <= 0 && planned <= 0) continue;
    // Prefer plan deviation when a plan exists; else absolute spend.
    const deviation =
      planned > 0 ? Math.abs(actual - planned) : actual;
    if (!best || deviation > best.deviationCents) {
      best = {
        value,
        label: categoryLabel(value, params.categories),
        actualCents: actual,
        plannedCents: planned,
        deviationCents: deviation,
      };
    }
  }
  return best;
}

function buildBiggestMoverSlide(mover: BiggestMover | null): RecapSlide {
  if (!mover) {
    return {
      id: "biggest_mover",
      eyebrow: "BIGGEST MOVER",
      headline: "No category standout",
      body: "There wasn’t a clear category deviation to highlight.",
      unavailable: true,
    };
  }

  let body: string;
  if (mover.plannedCents > 0 && mover.actualCents > mover.plannedCents) {
    const over = mover.actualCents - mover.plannedCents;
    body = `__OVER__${over} over its plan — the category to watch next cycle.`;
  } else if (mover.plannedCents > 0 && mover.actualCents <= mover.plannedCents) {
    const under = mover.plannedCents - mover.actualCents;
    body = `__UNDER__${under} under its plan. A calm note for next cycle.`;
  } else {
    body = "The largest category by spend this cycle — worth a gentle look next time.";
  }

  return {
    id: "biggest_mover",
    eyebrow: "BIGGEST MOVER",
    headline: mover.label,
    heroAmountCents: mover.actualCents,
    body,
  };
}

function buildSavingsSlide(params: {
  plannedSavingsCents: number;
  actualContributionsCents: number;
  hasContributionsData: boolean;
  savingsKept: boolean;
  leftOverCents: number;
}): RecapSlide {
  if (!params.hasContributionsData) {
    return {
      id: "savings",
      eyebrow: "SAVINGS",
      headline: "Savings history",
      body: "Contribution records were not preserved for this cycle.",
      unavailable: true,
    };
  }

  const { plannedSavingsCents, actualContributionsCents, leftOverCents } = params;

  if (plannedSavingsCents <= 0) {
    return {
      id: "savings",
      eyebrow: "SAVINGS",
      headline: "No savings plan",
      heroAmountCents: actualContributionsCents,
      body:
        actualContributionsCents > 0
          ? "Contributions were recorded even without a monthly savings plan."
          : "Savings plan not set for this cycle.",
    };
  }

  if (params.savingsKept) {
    const extra =
      leftOverCents > 0
        ? ` Your full __PLAN__${plannedSavingsCents} reached your goals, and __EXTRA__${leftOverCents} extra stayed in your account.`
        : ` Your full __PLAN__${plannedSavingsCents} reached your goals.`;
    return {
      id: "savings",
      eyebrow: "SAVINGS",
      headline: "Plan kept ✓",
      heroAmountCents: actualContributionsCents,
      body: extra.trim(),
    };
  }

  return {
    id: "savings",
    eyebrow: "SAVINGS",
    headline: "Plan missed",
    heroAmountCents: actualContributionsCents,
    body: `__KEPT__${actualContributionsCents} of __PLAN__${plannedSavingsCents} planned reached your goals. The gap went to spending elsewhere.`,
  };
}

function buildVerdictSlide(params: {
  verdict: CycleVerdictResult;
  moverLabel: string | null;
  isFirstFinishedCycle: boolean;
}): RecapSlide {
  const { verdict, moverLabel, isFirstFinishedCycle } = params;

  let pillLabel: string;
  let pillTone: RecapPillTone;
  switch (verdict.verdict) {
    case "on_plan":
      pillLabel = "On plan cycle";
      pillTone = "healthy";
      break;
    case "tough":
      pillLabel = "Tough cycle";
      pillTone = "tough";
      break;
    case "mixed":
      pillLabel = "Mixed cycle";
      pillTone = "caution";
      break;
    default:
      pillLabel = "Cycle noted";
      pillTone = "info";
  }

  let body: string;
  if (isFirstFinishedCycle) {
    body =
      "First cycle done. Next one, Sova will start spotting your patterns.";
  } else if (verdict.verdict === "tough" && moverLabel) {
    body = `Next cycle's one thing: give ${moverLabel} a plan it can actually keep.`;
  } else if (verdict.verdict === "mixed" && moverLabel) {
    body = `Next cycle's one thing: keep an eye on ${moverLabel}.`;
  } else if (verdict.verdict === "on_plan") {
    body = "Next cycle's one thing: keep the same calm pace.";
  } else {
    body = "Next cycle's one thing: set clear category plans early.";
  }

  return {
    id: "verdict",
    eyebrow: "VERDICT",
    headline: verdict.label,
    body,
    pillLabel,
    pillTone,
  };
}

/** Re-export STS helper for page wiring convenience (does not alter formula). */
export function computeCycleSafeToSpendCents(
  input: Parameters<typeof computeSafeToSpendCents>[0],
): number {
  return computeSafeToSpendCents(input);
}

export function resolvePlannedSavingsCents(goals: SavingsGoal[]): number {
  return resolveAuthoritativeSavingsPlan(goals).plannedGrossCents;
}

export type { CycleVerdict };
