import type { IncomeEntry, BudgetCycle } from "@/types/budgetCycle";
import type {
  BillFrequency,
  CategoryDef,
  Expense,
  RecurringBill,
  SavingsGoal,
} from "@/types/finance";
import { isDateInBudgetCycle } from "@/utils/budgetCycles";
import { buildSpentByCategory } from "@/utils/budgetPlanning";
import { resolveCategoryManagementStatus } from "@/utils/categoryBudgetStatus";
import {
  inferIncomeIconKey,
  resolveCategoryIconKey,
  type IconKey,
} from "@/utils/categoryIcons";
import {
  allocationGoals,
  resolveAuthoritativeSavingsPlan,
} from "@/utils/savingsAllocation";

export type BudgetRowSourceType =
  | "recurring_bill"
  | "category_budget"
  | "income_entry"
  | "savings_goal";

export type BudgetRowStatus = "healthy" | "near" | "over" | "exact" | "neutral";

export interface BudgetMoneyRow {
  id: string;
  sourceType: BudgetRowSourceType;
  sourceId: string;
  label: string;
  subtitle?: string;
  iconKey: IconKey;
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  progressPct: number;
  status: BudgetRowStatus;
  /** Cents over plan when status is over (for UI copy). */
  overPlanCents?: number;
  /** Category value for limit editing (flexible rows only). */
  categoryValue?: string;
  isCustom?: boolean;
  needsBudget?: boolean;
}

export interface BudgetGroupModel {
  id: string;
  title: string;
  rows: BudgetMoneyRow[];
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
  needsBudgetCount: number;
}

export interface BudgetSectionTotals {
  plannedCents: number;
  actualCents: number;
  remainingCents: number;
}

export interface BudgetPageModel {
  income: BudgetGroupModel;
  incomeTotals: BudgetSectionTotals;
  fixed: BudgetGroupModel;
  flexible: BudgetGroupModel;
  nonMonthly: BudgetGroupModel;
  expensesTotals: BudgetSectionTotals;
  contributions: BudgetGroupModel;
  contributionsTotals: BudgetSectionTotals;
  leftToBudgetCents: number;
  claimedCategoryValues: string[];
}

const FIXED_FREQUENCIES: ReadonlySet<BillFrequency> = new Set([
  "monthly",
  "weekly",
  "biweekly",
]);

const NON_MONTHLY_FREQUENCIES: ReadonlySet<BillFrequency> = new Set(["yearly"]);

function sumRows(rows: BudgetMoneyRow[]): BudgetSectionTotals {
  let plannedCents = 0;
  let actualCents = 0;
  for (const row of rows) {
    plannedCents += row.plannedCents;
    actualCents += row.actualCents;
  }
  return {
    plannedCents,
    actualCents,
    remainingCents: plannedCents - actualCents,
  };
}

function groupFromRows(
  id: string,
  title: string,
  rows: BudgetMoneyRow[],
): BudgetGroupModel {
  const totals = sumRows(rows);
  return {
    id,
    title,
    rows,
    plannedCents: totals.plannedCents,
    actualCents: totals.actualCents,
    remainingCents: totals.remainingCents,
    needsBudgetCount: rows.filter((r) => r.needsBudget).length,
  };
}

function progressPct(actualCents: number, plannedCents: number): number {
  if (plannedCents <= 0) return 0;
  return Math.min(100, Math.round((actualCents / plannedCents) * 100));
}

function remainingStatus(
  remainingCents: number,
  plannedCents: number,
  actualCents: number,
): BudgetRowStatus {
  if (plannedCents <= 0 && actualCents <= 0) return "neutral";
  if (plannedCents <= 0 && actualCents > 0) return "over";
  if (remainingCents < 0) return "over";
  if (remainingCents === 0) return "exact";
  const management = resolveCategoryManagementStatus(actualCents, plannedCents);
  if (management === "near") return "near";
  return "healthy";
}

function billSubtitle(bill: RecurringBill): string {
  if (bill.frequency === "yearly") return "Yearly · due this cycle";
  if (bill.frequency === "weekly") return "Weekly";
  if (bill.frequency === "biweekly") return "Every 2 weeks";
  return "Monthly";
}

function billIconKey(bill: RecurringBill, categories: CategoryDef[]): IconKey {
  const match = categories.find((c) => c.value === bill.category);
  return resolveCategoryIconKey(bill.category, {
    iconKey: match?.iconKey,
    label: bill.name,
  });
}

/**
 * Bills that belong in this cycle's Fixed / Non-monthly planning:
 * upcoming in the cycle window, plus bills paid during the cycle.
 */
export function collectCyclePlanningBills(params: {
  recurringBills: RecurringBill[];
  upcomingBills: RecurringBill[];
  selectedCycle: BudgetCycle | null;
  cycleStartIso: string | null;
  cycleEndIso: string | null;
}): RecurringBill[] {
  const { recurringBills, upcomingBills, selectedCycle } = params;
  const byId = new Map<string, RecurringBill>();

  for (const bill of upcomingBills) {
    byId.set(bill.id, bill);
  }

  for (const bill of recurringBills) {
    if (byId.has(bill.id)) continue;
    const paidDate = bill.lastPaidDate;
    if (!paidDate) continue;
    if (selectedCycle) {
      if (!isDateInBudgetCycle(paidDate, selectedCycle)) continue;
    } else if (params.cycleStartIso && params.cycleEndIso) {
      if (paidDate < params.cycleStartIso || paidDate >= params.cycleEndIso) continue;
    } else {
      continue;
    }
    byId.set(bill.id, bill);
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/**
 * Attribute cycle spend to bill rows by category without double-counting.
 * Prefer expenses that look like bill payments; otherwise allocate category spend once
 * across claiming bills (first bill takes remaining spend up to its planned amount).
 */
function attributeBillActuals(
  bills: RecurringBill[],
  expenses: Expense[],
): Map<string, number> {
  const actualByBillId = new Map<string, number>();
  const remainingSpendByCategory = { ...buildSpentByCategory(expenses) };

  // First pass: payment-linked expenses (created by markRecurringBillPaid).
  for (const bill of bills) {
    let linked = 0;
    for (const exp of expenses) {
      if (exp.category !== bill.category) continue;
      if (!exp.note?.startsWith(`Paid recurring bill: ${bill.name}`)) continue;
      linked += exp.amountCents;
    }
    if (linked > 0) {
      actualByBillId.set(bill.id, linked);
      const catLeft = Math.max(0, (remainingSpendByCategory[bill.category] ?? 0) - linked);
      remainingSpendByCategory[bill.category] = catLeft;
    }
  }

  // Second pass: leftover category spend to claiming bills (no double count).
  const billsByCategory = new Map<string, RecurringBill[]>();
  for (const bill of bills) {
    const list = billsByCategory.get(bill.category) ?? [];
    list.push(bill);
    billsByCategory.set(bill.category, list);
  }

  for (const [category, claimants] of billsByCategory) {
    let left = remainingSpendByCategory[category] ?? 0;
    if (left <= 0) continue;
    for (const bill of claimants) {
      if (left <= 0) break;
      const already = actualByBillId.get(bill.id) ?? 0;
      const room = Math.max(0, bill.amountCents - already);
      const take = Math.min(left, room > 0 ? room : left);
      if (take <= 0) continue;
      actualByBillId.set(bill.id, already + take);
      left -= take;
    }
    remainingSpendByCategory[category] = left;
  }

  return actualByBillId;
}

function buildBillRows(
  bills: RecurringBill[],
  categories: CategoryDef[],
  actualByBillId: Map<string, number>,
): BudgetMoneyRow[] {
  return bills.map((bill) => {
    const plannedCents = Math.max(0, bill.amountCents);
    const actualCents = Math.max(0, actualByBillId.get(bill.id) ?? 0);
    const remainingCents = plannedCents - actualCents;
    const status = remainingStatus(remainingCents, plannedCents, actualCents);

    return {
      id: `bill-${bill.id}`,
      sourceType: "recurring_bill",
      sourceId: bill.id,
      label: bill.name,
      subtitle: billSubtitle(bill),
      iconKey: billIconKey(bill, categories),
      plannedCents,
      actualCents,
      remainingCents,
      progressPct: progressPct(actualCents, plannedCents),
      status,
      overPlanCents: remainingCents < 0 ? -remainingCents : undefined,
      categoryValue: bill.category,
    };
  });
}

function buildIncomeRows(
  incomeEntries: IncomeEntry[],
  totalIncomeCents: number,
): BudgetMoneyRow[] {
  if (incomeEntries.length > 0) {
    return incomeEntries.map((entry) => {
      const amount = Math.max(0, entry.amountCents);
      const label = entry.source?.trim() || entry.note?.trim() || "Income";
      return {
        id: `income-${entry.id}`,
        sourceType: "income_entry" as const,
        sourceId: entry.id,
        label,
        subtitle: entry.note?.trim() && entry.source?.trim() ? entry.note.trim() : undefined,
        iconKey: inferIncomeIconKey(label),
        plannedCents: amount,
        actualCents: amount,
        remainingCents: 0,
        progressPct: amount > 0 ? 100 : 0,
        status: "exact" as const,
      };
    });
  }

  if (totalIncomeCents > 0) {
    return [
      {
        id: "income-total",
        sourceType: "income_entry",
        sourceId: "cycle-total",
        label: "Income",
        iconKey: "briefcase",
        plannedCents: totalIncomeCents,
        actualCents: totalIncomeCents,
        remainingCents: 0,
        progressPct: 100,
        status: "exact",
      },
    ];
  }

  return [];
}

function buildFlexibleRows(
  categories: CategoryDef[],
  categoryLimits: Record<string, number>,
  spentByCategory: Record<string, number>,
  claimedCategories: Set<string>,
): BudgetMoneyRow[] {
  const rows: BudgetMoneyRow[] = [];

  for (const cat of categories) {
    if (claimedCategories.has(cat.value)) continue;

    const limitCents = categoryLimits[cat.value] ?? 0;
    const spentCents = spentByCategory[cat.value] ?? 0;
    const hasLimit = limitCents > 0;
    const hasSpend = spentCents > 0;

    // Rows: budgeted categories, or unbudgeted with spend (attention).
    if (!hasLimit && !hasSpend) continue;

    const plannedCents = limitCents;
    const actualCents = spentCents;
    const remainingCents = hasLimit ? plannedCents - actualCents : 0;
    const status = hasLimit
      ? remainingStatus(remainingCents, plannedCents, actualCents)
      : actualCents > 0
        ? "over"
        : "neutral";

    const overAmount = hasLimit && remainingCents < 0 ? -remainingCents : 0;

    rows.push({
      id: `cat-${cat.value}`,
      sourceType: "category_budget",
      sourceId: cat.value,
      label: cat.label,
      iconKey: resolveCategoryIconKey(cat.value, { iconKey: cat.iconKey, label: cat.label }),
      plannedCents,
      actualCents,
      remainingCents,
      progressPct: progressPct(actualCents, plannedCents),
      status,
      overPlanCents: overAmount > 0 ? overAmount : undefined,
      categoryValue: cat.value,
      isCustom: cat.isCustom,
      needsBudget: !hasLimit,
    });
  }

  return rows.sort((a, b) => {
    if (a.needsBudget !== b.needsBudget) return a.needsBudget ? 1 : -1;
    if ((b.status === "over") !== (a.status === "over")) {
      return a.status === "over" ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
}

/** Categories that need a budget (no limit), excluding bill-claimed categories. */
export function countCategoriesNeedingBudget(
  categories: CategoryDef[],
  categoryLimits: Record<string, number>,
  claimedCategories: Set<string> | string[],
): number {
  const claimed = claimedCategories instanceof Set
    ? claimedCategories
    : new Set(claimedCategories);
  let count = 0;
  for (const cat of categories) {
    if (claimed.has(cat.value)) continue;
    if ((categoryLimits[cat.value] ?? 0) <= 0) count += 1;
  }
  return count;
}

function formatGoalSubtitle(goal: SavingsGoal, formatMoneyFn: (cents: number) => string): string {
  const target = formatMoneyFn(goal.targetCents);
  let dateLabel = "";
  try {
    const d = new Date(`${goal.targetDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      dateLabel = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    }
  } catch {
    dateLabel = goal.targetDate;
  }
  return dateLabel ? `Target ${target} · ${dateLabel}` : `Target ${target}`;
}

function buildContributionRows(
  goals: SavingsGoal[],
  contributionsByGoal: Record<string, number>,
  formatMoneyFn: (cents: number) => string,
): BudgetMoneyRow[] {
  return allocationGoals(goals).map((goal) => {
    const actualCents = Math.max(0, contributionsByGoal[goal.id] ?? 0);
    // Per-goal planned = contribution if set; else 0 (group planned uses meta plan only).
    const plannedCents = actualCents;
    const remainingCents = plannedCents - actualCents;
    return {
      id: `goal-${goal.id}`,
      sourceType: "savings_goal" as const,
      sourceId: goal.id,
      label: goal.name,
      subtitle: formatGoalSubtitle(goal, formatMoneyFn),
      iconKey: resolveCategoryIconKey(null, { label: goal.name }),
      plannedCents,
      actualCents,
      remainingCents,
      progressPct: progressPct(actualCents, plannedCents),
      status: remainingStatus(remainingCents, plannedCents, actualCents),
    };
  });
}

export interface BuildBudgetPageModelInput {
  categories: CategoryDef[];
  expenses: Expense[];
  categoryLimits: Record<string, number>;
  incomeEntries: IncomeEntry[];
  totalIncomeCents: number;
  recurringBills: RecurringBill[];
  upcomingBills: RecurringBill[];
  selectedCycle: BudgetCycle | null;
  cycleStartIso: string | null;
  cycleEndIso: string | null;
  savingsGoals: SavingsGoal[];
  contributionsByGoal: Record<string, number>;
  /** Used only for goal subtitle formatting. */
  formatMoneyFn: (cents: number) => string;
}

export function buildBudgetPageModel(input: BuildBudgetPageModelInput): BudgetPageModel {
  const {
    categories,
    expenses,
    categoryLimits,
    incomeEntries,
    totalIncomeCents,
    recurringBills,
    upcomingBills,
    selectedCycle,
    cycleStartIso,
    cycleEndIso,
    savingsGoals,
    contributionsByGoal,
    formatMoneyFn,
  } = input;

  const cycleBills = collectCyclePlanningBills({
    recurringBills,
    upcomingBills,
    selectedCycle,
    cycleStartIso,
    cycleEndIso,
  });

  const fixedBills = cycleBills.filter((b) => FIXED_FREQUENCIES.has(b.frequency));
  const nonMonthlyBills = cycleBills.filter((b) => NON_MONTHLY_FREQUENCIES.has(b.frequency));

  const claimedCategories = new Set<string>();
  for (const bill of [...fixedBills, ...nonMonthlyBills]) {
    if (bill.category) claimedCategories.add(bill.category);
  }

  const actualByBillId = attributeBillActuals(
    [...fixedBills, ...nonMonthlyBills],
    expenses,
  );

  const incomeRows = buildIncomeRows(incomeEntries, totalIncomeCents);
  const income = groupFromRows("income", "Income", incomeRows);
  const incomeTotals = sumRows(incomeRows);

  const fixedRows = buildBillRows(fixedBills, categories, actualByBillId);
  const fixed = groupFromRows("fixed", "Fixed", fixedRows);

  const spentByCategory = buildSpentByCategory(expenses);
  const flexibleRows = buildFlexibleRows(
    categories,
    categoryLimits,
    spentByCategory,
    claimedCategories,
  );
  const flexible = groupFromRows("flexible", "Flexible", flexibleRows);
  flexible.needsBudgetCount = countCategoriesNeedingBudget(
    categories,
    categoryLimits,
    claimedCategories,
  );

  const nonMonthlyRows = buildBillRows(nonMonthlyBills, categories, actualByBillId);
  const nonMonthly = groupFromRows("non-monthly", "Non-monthly", nonMonthlyRows);

  const expensesTotals: BudgetSectionTotals = {
    plannedCents: fixed.plannedCents + flexible.plannedCents + nonMonthly.plannedCents,
    actualCents: fixed.actualCents + flexible.actualCents + nonMonthly.actualCents,
    remainingCents: 0,
  };
  expensesTotals.remainingCents =
    expensesTotals.plannedCents - expensesTotals.actualCents;

  const plan = resolveAuthoritativeSavingsPlan(savingsGoals);
  const plannedContributions = plan.plannedGrossCents;
  const contributionRows = buildContributionRows(
    savingsGoals,
    contributionsByGoal,
    formatMoneyFn,
  );
  const contributionActual = contributionRows.reduce((s, r) => s + r.actualCents, 0);
  const contributions: BudgetGroupModel = {
    id: "savings-goals",
    title: "Savings goals",
    rows: contributionRows,
    plannedCents: plannedContributions,
    actualCents: contributionActual,
    remainingCents: plannedContributions - contributionActual,
    needsBudgetCount: 0,
  };
  const contributionsTotals: BudgetSectionTotals = {
    plannedCents: plannedContributions,
    actualCents: contributionActual,
    remainingCents: plannedContributions - contributionActual,
  };

  const leftToBudgetCents =
    incomeTotals.plannedCents -
    fixed.plannedCents -
    flexible.plannedCents -
    nonMonthly.plannedCents -
    contributionsTotals.plannedCents;

  return {
    income,
    incomeTotals,
    fixed,
    flexible,
    nonMonthly,
    expensesTotals,
    contributions,
    contributionsTotals,
    leftToBudgetCents,
    claimedCategoryValues: Array.from(claimedCategories),
  };
}

export function budgetRowBarTone(
  status: BudgetRowStatus,
): "success" | "warning" | "destructive" | "primary" | "muted" {
  if (status === "over") return "destructive";
  if (status === "near") return "warning";
  if (status === "healthy") return "success";
  if (status === "exact") return "primary";
  return "muted";
}
