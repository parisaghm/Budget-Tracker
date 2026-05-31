/**
 * Audits "Left in this cycle" against stored Supabase data.
 * Run: node scripts/audit-home-dashboard.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { format, startOfDay, parseISO } from "date-fns";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(resolve(root, ".env"), "utf8").replace(/^\uFEFF/, "");
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

function euros(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

function monthsRemaining(targetDateIso) {
  const target = startOfDay(parseISO(targetDateIso.slice(0, 10) + "-01".replace(/-\d{2}-01$/, "") || targetDateIso));
  const today = startOfDay(new Date());
  const targetMonth = new Date(target.getFullYear(), target.getMonth(), 1);
  const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const diff =
    (targetMonth.getFullYear() - todayMonth.getFullYear()) * 12 +
    (targetMonth.getMonth() - todayMonth.getMonth());
  return Math.max(0, diff);
}

function goalMonthlyRequired(goal) {
  const remaining = Math.max(0, goal.target_cents - goal.saved_cents);
  const months = monthsRemaining(goal.target_date);
  return months > 0 ? Math.ceil(remaining / months) : 0;
}

function getCurrentMonth() {
  return format(new Date(), "yyyy-MM");
}

function getDefaultNextIncomeDateForMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return next;
}

function parseBillDueDate(iso) {
  return startOfDay(parseISO(iso.slice(0, 10)));
}

function getUpcomingBills(bills, rangeEndIso, rangeStartIso, referenceDate = new Date()) {
  const rangeEnd = rangeEndIso ? startOfDay(parseISO(rangeEndIso.slice(0, 10))) : null;
  const rangeStart = rangeStartIso ? startOfDay(parseISO(rangeStartIso.slice(0, 10))) : null;
  const today = startOfDay(referenceDate);

  return bills
    .filter((bill) => {
      if (bill.status !== "upcoming") return false;
      if (!bill.next_due_date?.trim()) return false;
      const due = parseBillDueDate(bill.next_due_date);
      if (rangeEnd && due >= rangeEnd) return false;
      if (rangeStart && due < rangeStart && due >= today) return false;
      return true;
    })
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
}

function computeSafeToSpend(input) {
  const activeSavings = Math.max(
    0,
    input.savingsGoalsForCurrentCycleCents - (input.pausedGoalsBoostCents ?? 0),
  );
  return (
    input.incomeForCurrentCycleCents +
    (input.rolloverBoostCents ?? 0) -
    input.spentSoFarCents -
    input.upcomingBillsBeforeIncomeDateCents -
    activeSavings
  );
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("YOUR_PROJECT")) {
    console.log("No Supabase credentials — cannot audit live data.");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const today = new Date();
  const currentMonth = getCurrentMonth();

  const { data: sessionData } = await supabase.auth.getSession();
  let userId = sessionData?.session?.user?.id;

  if (!userId) {
    const { data: users, error: usersErr } = await supabase.from("budget_months").select("user_id").limit(1);
    if (usersErr) {
      console.error("Auth required or RLS blocked:", usersErr.message);
      process.exit(1);
    }
    userId = users?.[0]?.user_id;
  }

  if (!userId) {
    console.log("No user data found in Supabase.");
    process.exit(1);
  }

  console.log(`Auditing user ${userId.slice(0, 8)}… for month ${currentMonth}\n`);

  const [budgetRes, expensesRes, billsRes, goalsRes] = await Promise.all([
    supabase.from("budget_months").select("*").eq("user_id", userId).eq("month", currentMonth).maybeSingle(),
    supabase.from("expenses").select("*").eq("user_id", userId).eq("month", currentMonth),
    supabase.from("recurring_bills").select("*").eq("user_id", userId),
    supabase.from("savings_goals").select("*").eq("user_id", userId),
  ]);

  for (const [name, res] of [
    ["budget", budgetRes],
    ["expenses", expensesRes],
    ["bills", billsRes],
    ["goals", goalsRes],
  ]) {
    if (res.error) {
      console.error(`${name} query failed:`, res.error.message);
      process.exit(1);
    }
  }

  const budget = budgetRes.data;
  const expenses = expensesRes.data ?? [];
  const bills = billsRes.data ?? [];
  const goals = goalsRes.data ?? [];

  const incomeCents = budget?.salary_cents ?? 0;
  const spentCents = expenses.reduce((s, e) => s + e.amount_cents, 0);

  const nextSalaryDate = getDefaultNextIncomeDateForMonth(currentMonth);
  const monthStartIso = `${currentMonth}-01`;
  const upcomingBills = getUpcomingBills(bills, nextSalaryDate, monthStartIso, today);
  const billsCents = upcomingBills.reduce((s, b) => s + b.amount_cents, 0);

  const savingsCents = goals.reduce((s, g) => s + goalMonthlyRequired(g), 0);

  const safeToSpendCents = computeSafeToSpend({
    incomeForCurrentCycleCents: incomeCents,
    spentSoFarCents: spentCents,
    upcomingBillsBeforeIncomeDateCents: billsCents,
    savingsGoalsForCurrentCycleCents: savingsCents,
  });

  console.log("=== STORED RECORDS ===");
  console.log(`Income (${currentMonth}): ${euros(incomeCents)}`);
  console.log(`Expenses (${expenses.length} in ${currentMonth}): ${euros(spentCents)}`);
  for (const e of expenses) {
    console.log(`  - ${e.date?.slice(0, 10)} ${e.category} ${euros(e.amount_cents)}${e.note ? ` (${e.note})` : ""}`);
  }
  console.log(`Upcoming bills (${upcomingBills.length} before ${nextSalaryDate}): ${euros(billsCents)}`);
  for (const b of upcomingBills) {
    console.log(`  - ${b.name} due ${b.next_due_date?.slice(0, 10)} ${euros(b.amount_cents)}`);
  }
  console.log(`Goals monthly allocation (${goals.length} goals): ${euros(savingsCents)}`);
  for (const g of goals) {
    const req = goalMonthlyRequired(g);
    console.log(`  - ${g.name}: ${euros(req)}/mo (target ${euros(g.target_cents)}, saved ${euros(g.saved_cents)})`);
  }

  console.log("\n=== CALCULATION (matches app hook, no local adjustments) ===");
  console.log(`Income:              ${euros(incomeCents)}`);
  console.log(`Spent so far:        − ${euros(spentCents)}`);
  console.log(`Upcoming bills:      − ${euros(billsCents)}`);
  console.log(`Goals / savings:     − ${euros(savingsCents)}`);
  console.log(`─────────────────────────────`);
  console.log(`Left in this cycle:  ${euros(safeToSpendCents)} (${safeToSpendCents} cents)`);

  console.log("\n=== TARGET CHECK ===");
  const targetCents = 39884;
  if (safeToSpendCents === targetCents) {
    console.log(`✓ Matches displayed ${euros(targetCents)} exactly (base calculation, no adjustments).`);
  } else {
    console.log(`Displayed ${euros(targetCents)} vs computed ${euros(safeToSpendCents)} — difference ${euros(safeToSpendCents - targetCents)}`);
    console.log("Check browser localStorage for bt_month_adjustments_v1 (rollover / paused goals).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
