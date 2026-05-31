/**
 * Replicates Home dashboard "Left in this cycle" from app modules.
 * Run: npx tsx scripts/audit-home-dashboard.ts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "date-fns";
import { createClient } from "@supabase/supabase-js";
import { buildDemoFinanceData } from "../src/data/demoFinanceSeed";
import { calculateGoalPlan } from "../src/utils/goalPlan";
import { getUpcomingBills } from "../src/utils/recurringBills";
import {
  getActiveCycleWindow,
  getDefaultNextIncomeDateForMonth,
  isIncomeCycleConfigured,
} from "../src/utils/incomeCycle";
import { readIncomeCycle } from "../src/utils/incomeCyclePreferences";
import { computeSafeToSpendCents } from "../src/utils/safeToSpend";
import { getCurrentMonth } from "../src/utils/money";
import { getMonthAdjustments } from "../src/utils/budgetDecisions";
import { getPausedGoalsAllocationCents } from "../src/utils/paceSupport";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8").replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env */
  }
  return env;
}

function euros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

interface AuditInputs {
  source: string;
  userId: string;
  currentMonth: string;
  incomeCents: number;
  spentCents: number;
  expenses: Array<{ date: string; category: string; amountCents: number; note?: string | null }>;
  billsCents: number;
  upcomingBills: Array<{ name: string; nextDueDate: string; amountCents: number }>;
  savingsCents: number;
  goals: Array<{ name: string; monthlyRequiredCents: number }>;
  rolloverBoostCents: number;
  pausedGoalsBoostCents: number;
  nextIncomeDate: string;
  cycleWindowStart: string;
}

function auditFromInputs(input: AuditInputs, targetCents?: number) {
  const base = computeSafeToSpendCents({
    incomeForCurrentCycleCents: input.incomeCents,
    spentSoFarCents: input.spentCents,
    upcomingBillsBeforeIncomeDateCents: input.billsCents,
    savingsGoalsForCurrentCycleCents: input.savingsCents,
  });

  const displayed = computeSafeToSpendCents({
    incomeForCurrentCycleCents: input.incomeCents,
    spentSoFarCents: input.spentCents,
    upcomingBillsBeforeIncomeDateCents: input.billsCents,
    savingsGoalsForCurrentCycleCents: input.savingsCents,
    rolloverBoostCents: input.rolloverBoostCents,
    pausedGoalsBoostCents: input.pausedGoalsBoostCents,
  });

  console.log(`\n========== ${input.source} ==========`);
  console.log(`User/month: ${input.userId.slice(0, 8)}… / ${input.currentMonth}`);
  console.log(`Income cycle window: ${input.cycleWindowStart} → ${input.nextIncomeDate}\n`);

  console.log("STORED RECORDS");
  console.log(`  Income: ${euros(input.incomeCents)}`);
  console.log(`  Expenses (${input.expenses.length}): ${euros(input.spentCents)}`);
  for (const e of input.expenses) {
    console.log(`    · ${e.date.slice(0, 10)} ${e.category} ${euros(e.amountCents)}${e.note ? ` — ${e.note}` : ""}`);
  }
  console.log(`  Upcoming bills (${input.upcomingBills.length}): ${euros(input.billsCents)}`);
  for (const b of input.upcomingBills) {
    console.log(`    · ${b.name} due ${b.nextDueDate.slice(0, 10)} ${euros(b.amountCents)}`);
  }
  console.log(`  Goals monthly (${input.goals.length}): ${euros(input.savingsCents)}`);
  for (const g of input.goals) {
    console.log(`    · ${g.name}: ${euros(g.monthlyRequiredCents)}/mo`);
  }

  console.log("\nCALCULATION (Dashboard formula)");
  console.log(`  Income:                 ${euros(input.incomeCents)}`);
  if (input.rolloverBoostCents > 0) {
    console.log(`  Carried over:         + ${euros(input.rolloverBoostCents)}`);
  }
  console.log(`  Spent so far:           − ${euros(input.spentCents)}`);
  console.log(`  Upcoming bills:         − ${euros(input.billsCents)}`);
  const activeSavings = Math.max(0, input.savingsCents - input.pausedGoalsBoostCents);
  console.log(`  Goals / savings:        − ${euros(activeSavings)}`);
  if (input.pausedGoalsBoostCents > 0) {
    console.log(`    (paused goals freed:  + ${euros(input.pausedGoalsBoostCents)}`);
  }
  console.log("  ─────────────────────────────");
  console.log(`  Base (hook):            ${euros(base)}`);
  console.log(`  Displayed (Home hero):  ${euros(displayed)}`);

  if (targetCents != null) {
    console.log("\nTARGET CHECK (€398.84)");
    if (displayed === targetCents) {
      console.log(`  ✓ Displayed value matches computed ${euros(displayed)}`);
    } else if (base === targetCents) {
      console.log(`  ~ Matches base hook (${euros(base)}) but hero may differ if adjustments apply`);
    } else {
      console.log(`  ✗ Expected ${euros(targetCents)}, computed ${euros(displayed)} (Δ ${euros(displayed - targetCents)})`);
    }
  }

  return { base, displayed };
}

function auditDemo(now = new Date(), targetCents?: number) {
  const data = buildDemoFinanceData(now);
  const currentMonth = getCurrentMonth();
  const budget = data.budgets[currentMonth];
  const expenses = data.expenses.filter((e) => e.month === currentMonth);
  const spentCents = expenses.reduce((s, e) => s + e.amountCents, 0);
  const incomeCycle = readIncomeCycle("demo");
  const cycleConfigured = isIncomeCycleConfigured(incomeCycle);
  const cycleWindow = cycleConfigured ? getActiveCycleWindow(incomeCycle, now) : null;
  const nextIncomeDate = cycleConfigured
    ? format(cycleWindow!.end, "yyyy-MM-dd")
    : getDefaultNextIncomeDateForMonth(currentMonth);
  const monthStartIso = cycleConfigured
    ? format(cycleWindow!.start, "yyyy-MM-dd")
    : `${currentMonth}-01`;
  const upcoming = getUpcomingBills(data.recurringBills, nextIncomeDate, monthStartIso, now);
  const savingsCents = data.savingsGoals.reduce(
    (s, g) => s + calculateGoalPlan(g).monthlyRequiredSavingCents,
    0,
  );
  const adjustments = getMonthAdjustments("demo", currentMonth);
  const pausedGoalsBoostCents = getPausedGoalsAllocationCents(
    data.savingsGoals,
    adjustments.pausedGoalIds,
  );

  return auditFromInputs(
    {
      source: "DEMO DATA (buildDemoFinanceData)",
      userId: "demo",
      currentMonth,
      incomeCents: budget?.salaryCents ?? 0,
      spentCents,
      expenses: expenses.map((e) => ({
        date: e.date,
        category: e.category,
        amountCents: e.amountCents,
        note: e.note,
      })),
      billsCents: upcoming.reduce((s, b) => s + b.amountCents, 0),
      upcomingBills: upcoming.map((b) => ({
        name: b.name,
        nextDueDate: b.nextDueDate,
        amountCents: b.amountCents,
      })),
      savingsCents,
      goals: data.savingsGoals.map((g) => ({
        name: g.name,
        monthlyRequiredCents: calculateGoalPlan(g).monthlyRequiredSavingCents,
      })),
      rolloverBoostCents: adjustments.rolloverBoostCents,
      pausedGoalsBoostCents,
      nextIncomeDate,
      cycleWindowStart: monthStartIso,
    },
    targetCents,
  );
}

async function auditSupabase(targetCents?: number) {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url?.startsWith("http") || !key) return null;

  const supabase = createClient(url, key);
  const currentMonth = getCurrentMonth();
  const today = new Date();

  const { data: budgetRows } = await supabase
    .from("budget_months")
    .select("user_id, salary_cents")
    .eq("month", currentMonth)
    .limit(5);

  if (!budgetRows?.length) {
    console.log("\nSupabase: no budget rows for current month (RLS may require login).");
    return null;
  }

  for (const row of budgetRows) {
    const userId = row.user_id as string;
    const [budgetRes, expensesRes, billsRes, goalsRes] = await Promise.all([
      supabase.from("budget_months").select("*").eq("user_id", userId).eq("month", currentMonth).maybeSingle(),
      supabase.from("expenses").select("*").eq("user_id", userId).eq("month", currentMonth),
      supabase.from("recurring_bills").select("*").eq("user_id", userId),
      supabase.from("savings_goals").select("*").eq("user_id", userId),
    ]);

    if (budgetRes.error || expensesRes.error || billsRes.error || goalsRes.error) continue;

    const budget = budgetRes.data;
    if (!budget) continue;

    const expenses = (expensesRes.data ?? []).map((e) => ({
      id: e.id,
      budgetMonthId: e.budget_month_id,
      month: e.month,
      amountCents: e.amount_cents,
      category: e.category,
      date: e.date,
      note: e.note,
      createdAt: e.created_at,
    }));
    const recurringBills = (billsRes.data ?? []).map((b) => ({
      id: b.id,
      userId: b.user_id,
      name: b.name,
      amountCents: b.amount_cents,
      category: b.category,
      dueDay: b.due_day,
      frequency: b.frequency,
      status: b.status,
      nextDueDate: b.next_due_date,
      note: b.note,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      seriesStartDate: b.series_start_date,
    }));
    const savingsGoals = (goalsRes.data ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: g.target_cents,
      savedCents: g.saved_cents,
      startDate: g.start_date,
      targetDate: g.target_date,
      createdAt: g.created_at,
    }));

    const spentCents = expenses.reduce((s, e) => s + e.amountCents, 0);
    const incomeCycle = readIncomeCycle(userId);
    const cycleConfigured = isIncomeCycleConfigured(incomeCycle);
    const cycleWindow = cycleConfigured ? getActiveCycleWindow(incomeCycle, today) : null;
    const nextIncomeDate = cycleConfigured
      ? format(cycleWindow!.end, "yyyy-MM-dd")
      : getDefaultNextIncomeDateForMonth(currentMonth);
    const monthStartIso = cycleConfigured
      ? format(cycleWindow!.start, "yyyy-MM-dd")
      : `${currentMonth}-01`;
    const upcoming = getUpcomingBills(recurringBills, nextIncomeDate, monthStartIso, today);
    const savingsCents = savingsGoals.reduce(
      (s, g) => s + calculateGoalPlan(g).monthlyRequiredSavingCents,
      0,
    );
    const adjustments = getMonthAdjustments(userId, currentMonth);
    const pausedGoalsBoostCents = getPausedGoalsAllocationCents(
      savingsGoals,
      adjustments.pausedGoalIds,
    );

    auditFromInputs(
      {
        source: `SUPABASE (user ${userId.slice(0, 8)}…)`,
        userId,
        currentMonth,
        incomeCents: budget.salary_cents ?? 0,
        spentCents,
        expenses: expenses.map((e) => ({
          date: e.date,
          category: e.category,
          amountCents: e.amountCents,
          note: e.note,
        })),
        billsCents: upcoming.reduce((s, b) => s + b.amountCents, 0),
        upcomingBills: upcoming.map((b) => ({
          name: b.name,
          nextDueDate: b.nextDueDate,
          amountCents: b.amountCents,
        })),
        savingsCents,
        goals: savingsGoals.map((g) => ({
          name: g.name,
          monthlyRequiredCents: calculateGoalPlan(g).monthlyRequiredSavingCents,
        })),
        rolloverBoostCents: adjustments.rolloverBoostCents,
        pausedGoalsBoostCents,
        nextIncomeDate,
        cycleWindowStart: monthStartIso,
      },
      targetCents,
    );
  }

  return true;
}

const targetCents = 39884;
console.log("Home dashboard financial audit");
console.log(`Reference display value from user report: ${euros(targetCents)}`);

auditDemo(new Date(), targetCents);
await auditSupabase(targetCents);

console.log("\nNOTE: Browser-only adjustments live in localStorage (bt_month_adjustments_v1).");
console.log("This script reads getMonthAdjustments() which is empty outside the browser.");
