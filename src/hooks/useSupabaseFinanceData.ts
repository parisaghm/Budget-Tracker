import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { addMonths, format, startOfMonth } from "date-fns";
import {
  BillFrequency,
  BillStatus,
  BudgetMonth,
  CategoryDef,
  CategoryLimitsByMonth,
  DEFAULT_CATEGORIES,
  Expense,
  MonthData,
  RecurringBill,
  SavingsGoal,
} from "@/types/finance";
import { DEFAULT_CATEGORY_ICON_KEY, inferIconKeyFromLabel } from "@/utils/categoryIcons";
import { getCurrentMonth, getPreviousMonth, normalizeCurrencyCode, normalizeYearMonthYm } from "@/utils/money";
import { calculateGoalPlan } from "@/utils/goalPlan";
import {
  formatSupabaseDateCellToIso,
  getNextDateForFrequency,
  getUpcomingBills,
  normalizeStoredBillNextDueDate,
} from "@/utils/recurringBills";
import { hasSupabaseEnv, supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { buildDemoFinanceData } from "@/data/demoFinanceSeed";
import type { OnboardingData } from "@/types/onboarding";
import {
  defaultOnboardingRecurringSchedule,
  mergeOnboardingData,
  ONBOARDING_CATEGORY_TO_CUSTOM_LABEL,
  ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME,
  onboardingFixedBillAlreadyExists,
} from "@/utils/onboarding";
import type { IncomeCycle } from "@/types/incomeCycle";
import {
  getActiveBudgetMonthKey,
  getCycleWindowDatesForMonthKey,
  getDefaultNextIncomeDateForMonth,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { readIncomeCycle, writeIncomeCycle } from "@/utils/incomeCyclePreferences";
import {
  fetchUserSettings,
  getSupabaseProjectHost,
  upsertUserIncomeCycle,
  upsertUserSelectedMonth,
  type MonthSelectionSource,
  type SettingsPersistenceSource,
} from "@/utils/userSettings";
import {
  canWriteMonthlyIncome,
  runWithIncomeWrite,
  warnBlockedIncomeWrite,
  type IncomeWriteSource,
} from "@/utils/budgetIncomeGuard";
import { isBillReservedInUpcoming, logBillPaymentDebug } from "@/utils/billPayment";
import { computeSafeToSpendCents } from "@/utils/safeToSpend";
import type { BudgetCycle } from "@/types/budgetCycle";
import {
  budgetMonthKeyFromCycle,
  findCycleForMonthKey,
  findPreviousCycle,
  isDateInBudgetCycle,
} from "@/utils/budgetCycles";
import { ensureCyclesUpToToday } from "@/utils/budgetCycleService";
import { useCycleIncome } from "@/hooks/useCycleIncome";

interface StoredData {
  budgets: Record<string, BudgetMonth>;
  expenses: Expense[];
  customCategories: CategoryDef[];
  savingsGoals: SavingsGoal[];
  categoryLimits: CategoryLimitsByMonth;
  recurringBills: RecurringBill[];
}

interface PendingExpenseItem {
  id: string;
  amountCents: number;
  category: string;
  date: string;
  note: string;
  month: string;
  createdAt: string;
}

interface BudgetMonthRow {
  id: string;
  month: string;
  salary_cents: number;
  currency: string | null;
  created_at: string;
  income_note: string | null;
}

interface ExpenseRow {
  id: string;
  budget_month_id: string;
  month: string;
  amount_cents: number;
  category: string;
  date: string;
  note: string | null;
  created_at: string;
}

interface CategoryRow {
  id: string;
  value: string;
  label: string;
  icon_key: string | null;
  is_custom: boolean;
  month: string | null;
  limit_cents: number | null;
}

interface GoalRow {
  id: string;
  name: string;
  target_cents: number;
  saved_cents: number;
  start_date: string;
  target_date: string;
  created_at: string;
}

interface RecurringBillRow {
  id: string;
  user_id: string;
  name: string;
  amount_cents: number;
  category: string;
  due_day: number;
  frequency: BillFrequency;
  status: BillStatus;
  last_paid_date: string | null;
  next_due_date: string;
  series_start_date: string | null;
  payment_count: number | null;
  payments_completed: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const CURRENT_MONTH_STORAGE_KEY = "bt_selected_month";
const PENDING_EXPENSES_STORAGE_KEY = "bt_pending_expenses";

function readCurrentMonthFromLocalStorage(): string {
  const fallback = getCurrentMonth();
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(CURRENT_MONTH_STORAGE_KEY);
    if (stored && /^\d{4}-\d{2}$/.test(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage read failures and use current month.
  }
  return fallback;
}

function readInitialMonth(incomeCycle: IncomeCycle | null | undefined): string {
  if (incomeCycle && isIncomeCycleConfigured(incomeCycle)) {
    return getActiveBudgetMonthKey(incomeCycle);
  }
  return readCurrentMonthFromLocalStorage();
}

function writeCurrentMonthToLocalStorage(month: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CURRENT_MONTH_STORAGE_KEY, month);
  } catch {
    // Ignore storage write failures.
  }
}

function recurringBillsStorageKey(userId: string): string {
  return `bt_recurring_bills_${userId}`;
}

function pendingExpensesStorageKey(userId: string): string {
  return `${PENDING_EXPENSES_STORAGE_KEY}_${userId}`;
}

function readPendingExpensesFromLocal(userId: string): PendingExpenseItem[] {
  try {
    const raw = window.localStorage.getItem(pendingExpensesStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingExpensesToLocal(userId: string, items: PendingExpenseItem[]): void {
  try {
    window.localStorage.setItem(pendingExpensesStorageKey(userId), JSON.stringify(items));
  } catch {
    // Ignore storage write failures.
  }
}

function readRecurringBillsFromLocal(userId: string): RecurringBill[] {
  try {
    const raw = window.localStorage.getItem(recurringBillsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const bills = Array.isArray(parsed) ? (parsed as RecurringBill[]) : [];
    return bills.map((b) => ({
      ...b,
      nextDueDate: normalizeStoredBillNextDueDate(b.nextDueDate, b.dueDay, new Date(), b.seriesStartDate),
    }));
  } catch {
    return [];
  }
}

function writeRecurringBillsToLocal(userId: string, bills: RecurringBill[]): void {
  try {
    window.localStorage.setItem(recurringBillsStorageKey(userId), JSON.stringify(bills));
  } catch {
    // Ignore storage write failures.
  }
}

function recurringBillToSupabaseRow(bill: RecurringBill, userId: string) {
  return {
    id: bill.id,
    user_id: userId,
    name: bill.name,
    amount_cents: bill.amountCents,
    category: bill.category,
    due_day: bill.dueDay,
    frequency: bill.frequency,
    status: bill.status,
    last_paid_date: bill.lastPaidDate ?? null,
    next_due_date: bill.nextDueDate,
    series_start_date: bill.seriesStartDate ?? bill.nextDueDate,
    payment_count: bill.paymentCount ?? null,
    payments_completed: bill.paymentsCompleted ?? 0,
    note: bill.note?.trim() ? bill.note : null,
    updated_at: new Date().toISOString(),
  };
}

async function migrateLocalOnlyRecurringBills(
  userId: string,
  localBills: RecurringBill[],
  remoteIds: Set<string>,
): Promise<number> {
  const localOnly = localBills.filter((bill) => !remoteIds.has(bill.id));
  if (!localOnly.length) return 0;

  let migrated = 0;
  for (const bill of localOnly) {
    const { error } = await supabase
      .from("recurring_bills")
      .upsert(recurringBillToSupabaseRow(bill, userId), { onConflict: "id" });
    if (!error) {
      migrated += 1;
    } else if (import.meta.env.DEV && !isRecurringBillsSchemaError(error.message)) {
      console.warn("[finance] recurring bill migration failed", bill.name, error.message);
    }
  }

  if (import.meta.env.DEV && migrated > 0) {
    console.debug("[finance] migrated local recurring bills to Supabase", migrated);
  }

  return migrated;
}

function categoryLimitsStorageKey(userId: string): string {
  return `bt_category_limits_${userId}`;
}

function readCategoryLimitsFromLocal(userId: string): CategoryLimitsByMonth {
  try {
    const raw = window.localStorage.getItem(categoryLimitsStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as CategoryLimitsByMonth;
  } catch {
    return {};
  }
}

function writeCategoryLimitsToLocal(userId: string, limits: CategoryLimitsByMonth): void {
  try {
    window.localStorage.setItem(categoryLimitsStorageKey(userId), JSON.stringify(limits));
  } catch {
    // Ignore storage write failures.
  }
}

function mergeCategoryLimits(
  remote: CategoryLimitsByMonth,
  local: CategoryLimitsByMonth,
): CategoryLimitsByMonth {
  const merged: CategoryLimitsByMonth = { ...local };
  for (const [month, limits] of Object.entries(remote)) {
    merged[month] = { ...(merged[month] ?? {}), ...limits };
  }
  return merged;
}

function parseLimitCents(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function applyCategoryLimitUpdate(
  prev: StoredData,
  month: string,
  categoryValue: string,
  limitCents: number,
): { nextData: StoredData; nextCategoryLimits: CategoryLimitsByMonth } {
  const monthLimits = prev.categoryLimits[month] || {};
  const next = { ...monthLimits, [categoryValue]: limitCents };
  if (limitCents <= 0) {
    const { [categoryValue]: _removed, ...rest } = next;
    const nextCategoryLimits = {
      ...prev.categoryLimits,
      [month]: rest,
    };
    return {
      nextData: { ...prev, categoryLimits: nextCategoryLimits },
      nextCategoryLimits,
    };
  }
  const nextCategoryLimits = {
    ...prev.categoryLimits,
    [month]: next,
  };
  return {
    nextData: { ...prev, categoryLimits: nextCategoryLimits },
    nextCategoryLimits,
  };
}

function isRecurringBillsSchemaError(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("recurring_bills") && (
    normalized.includes("does not exist") ||
    normalized.includes("relation") ||
    normalized.includes("schema cache")
  );
}

/**
 * Budget-month key (YYYY-MM) an expense belongs to for a given date.
 * Mirrors how new expenses are filed: when an income cycle is configured the
 * key is the cycle window that contains the date (so a date inside the current
 * cycle stays in the current budget month even across a calendar-month
 * boundary); otherwise it is the plain calendar month.
 */
function budgetMonthKeyForDate(dateYmd: string, cycle: IncomeCycle | null | undefined): string {
  const calendarKey = normalizeYearMonthYm(dateYmd.slice(0, 7));
  if (!isIncomeCycleConfigured(cycle)) return calendarKey;
  const m = dateYmd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return calendarKey;
  const parsed = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(parsed.getTime())) return calendarKey;
  return getActiveBudgetMonthKey(cycle, parsed);
}

const initialData: StoredData = {
  budgets: {},
  expenses: [],
  customCategories: [],
  savingsGoals: [],
  categoryLimits: {},
  recurringBills: [],
};

const DEMO_EDIT_MESSAGE =
  "This is sample data. Create a free account to save your own numbers.";

export interface FinanceDiagnosticsSnapshot {
  supabaseHost: string | null;
  userId: string | null;
  currentMonth: string;
  monthSelectionSource: MonthSelectionSource;
  settingsSource: SettingsPersistenceSource;
  incomeCycleConfigured: boolean;
  cycleStart: string | null;
  cycleEnd: string | null;
  incomeCents: number;
  spentCents: number;
  savingsCents: number;
  billsCents: number;
  settingsHydrated: boolean;
  recurringBillsCount: number;
  upcomingBillsCount: number;
  localOnlyRecurringBillsCount: number;
}

function useFinanceDataInternal() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const financeUserId = user?.id ?? (isDemoMode ? "demo" : "");
  const monthManuallySelectedRef = useRef(false);
  const [currentMonth, setCurrentMonthState] = useState(() =>
    readInitialMonth(readIncomeCycle(financeUserId || undefined)),
  );
  const [data, setData] = useState<StoredData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [useRecurringBillsLocalFallback, setUseRecurringBillsLocalFallback] = useState(false);
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpenseItem[]>([]);
  const [incomeCycle, setIncomeCycle] = useState<IncomeCycle | null>(() =>
    readIncomeCycle(financeUserId || undefined),
  );
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [monthSelectionSource, setMonthSelectionSource] = useState<MonthSelectionSource>(
    isDemoMode ? "demo" : "default_current_month",
  );
  const [settingsSource, setSettingsSource] = useState<SettingsPersistenceSource>("none");
  const [localOnlyRecurringBillsCount, setLocalOnlyRecurringBillsCount] = useState(0);
  const [budgetCycles, setBudgetCycles] = useState<BudgetCycle[]>([]);
  /** Discards stale `loadFromSupabase` results when a newer load started (e.g. onboarding sync vs initial fetch). */
  const financeLoadGenerationRef = useRef(0);

  useEffect(() => {
    if (isDemoMode) {
      setSettingsHydrated(true);
      setMonthSelectionSource("demo");
      setSettingsSource("none");
      return;
    }

    if (!financeUserId) {
      setSettingsHydrated(true);
      setMonthSelectionSource("default_current_month");
      setSettingsSource("none");
      return;
    }

    let cancelled = false;
    setSettingsHydrated(false);

    void (async () => {
      const remote = hasSupabaseEnv ? await fetchUserSettings(financeUserId) : null;
      if (cancelled) return;

      const localCycle = readIncomeCycle(financeUserId);
      let resolvedCycle: IncomeCycle | null = null;
      let resolvedSettingsSource: SettingsPersistenceSource = "none";

      if (remote?.incomeCycle) {
        resolvedCycle = remote.incomeCycle;
        resolvedSettingsSource = "supabase";
        writeIncomeCycle(financeUserId, resolvedCycle);
      } else if (localCycle) {
        resolvedCycle = localCycle;
        resolvedSettingsSource = "localStorage";
        if (hasSupabaseEnv) {
          const migrated = await upsertUserIncomeCycle(financeUserId, resolvedCycle);
          if (migrated) {
            resolvedSettingsSource = "supabase";
          }
        }
      }

      setIncomeCycle(resolvedCycle);
      setSettingsSource(resolvedSettingsSource);

      if (resolvedCycle) {
        const activeMonth = getActiveBudgetMonthKey(resolvedCycle);
        const remoteMonth = remote?.selectedMonth ?? null;
        const useRemoteMonth =
          remoteMonth &&
          /^\d{4}-\d{2}$/.test(remoteMonth) &&
          remoteMonth !== activeMonth;

        if (useRemoteMonth) {
          monthManuallySelectedRef.current = true;
          setCurrentMonthState(normalizeYearMonthYm(remoteMonth));
          setMonthSelectionSource("manual_navigation");
        } else {
          monthManuallySelectedRef.current = false;
          setCurrentMonthState(activeMonth);
          setMonthSelectionSource("income_cycle_active");
        }
      } else {
        const localMonth = readCurrentMonthFromLocalStorage();
        const remoteMonth = remote?.selectedMonth ?? null;
        const fallbackMonth = getCurrentMonth();
        const resolvedMonth = remoteMonth ?? (localMonth !== fallbackMonth ? localMonth : fallbackMonth);

        if (remoteMonth) {
          setMonthSelectionSource("supabase_selected_month");
        } else if (localMonth !== fallbackMonth) {
          setMonthSelectionSource("localStorage_selected_month");
          if (hasSupabaseEnv) {
            void upsertUserSelectedMonth(financeUserId, localMonth);
          }
        } else {
          setMonthSelectionSource("default_current_month");
        }

        setCurrentMonthState(normalizeYearMonthYm(resolvedMonth));
      }

      setSettingsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [financeUserId, isDemoMode]);

  const saveIncomeCycle = useCallback(
    (next: IncomeCycle | null) => {
      const normalized = next && isIncomeCycleConfigured(next) ? next : null;
      setIncomeCycle(normalized);
      if (financeUserId) {
        writeIncomeCycle(financeUserId, normalized);
        if (!isDemoMode && hasSupabaseEnv) {
          void upsertUserIncomeCycle(financeUserId, normalized).then((ok) => {
            if (ok) setSettingsSource("supabase");
          });
        }
      }
      // Schedule preference only — do not rewrite frozen cycle dates or jump month
      // via recomputed windows. Future cycles use the new schedule at creation time.
      if (normalized) {
        setMonthSelectionSource("income_cycle_active");
      }
    },
    [financeUserId, isDemoMode],
  );

  const setCurrentMonth = useCallback(
    (month: string) => {
      monthManuallySelectedRef.current = true;
      const normalized = normalizeYearMonthYm(month);
      setCurrentMonthState(normalized);
      setMonthSelectionSource(
        isIncomeCycleConfigured(incomeCycle) ? "manual_navigation" : "supabase_selected_month",
      );
      if (financeUserId && !isDemoMode && hasSupabaseEnv) {
        void upsertUserSelectedMonth(financeUserId, normalized).then((ok) => {
          if (ok) setSettingsSource("supabase");
        });
      }
    },
    [financeUserId, incomeCycle, isDemoMode],
  );

  useEffect(() => {
    if (isIncomeCycleConfigured(incomeCycle)) return;
    writeCurrentMonthToLocalStorage(currentMonth);
  }, [currentMonth, incomeCycle]);

  useEffect(() => {
    if (isDemoMode || !user || !hasSupabaseEnv || !settingsHydrated) {
      return;
    }
    let cancelled = false;
    void ensureCyclesUpToToday({ userId: user.id, incomeCycle })
      .then((cycles) => {
        if (cancelled) return;
        setBudgetCycles(cycles);
        if (!monthManuallySelectedRef.current) {
          const active = cycles.find((c) => c.status === "active");
          if (active) {
            const key = budgetMonthKeyFromCycle(active);
            setCurrentMonthState((prev) => (prev === key ? prev : key));
            setMonthSelectionSource("income_cycle_active");
          }
        }
      })
      .catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.warn("[finance] ensureCyclesUpToToday failed", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [incomeCycle, isDemoMode, settingsHydrated, user]);

  const loadFromSupabase = useCallback(
    async (userId: string, options?: { signal?: AbortSignal; showLoading?: boolean }) => {
      const showLoading = options?.showLoading !== false;
      const signal = options?.signal;
      const generation = ++financeLoadGenerationRef.current;

      if (showLoading) setIsLoading(true);

      try {
        const [budgetsRes, expensesRes, categoriesRes, goalsRes, recurringBillsRes] = await Promise.all([
          supabase.from("budget_months").select("*").eq("user_id", userId),
          supabase.from("expenses").select("*").eq("user_id", userId),
          supabase.from("categories").select("*").eq("user_id", userId),
          supabase.from("goals").select("*").eq("user_id", userId),
          supabase.from("recurring_bills").select("*").eq("user_id", userId),
        ]);

        if (signal?.aborted) {
          return;
        }

        if (generation !== financeLoadGenerationRef.current) {
          return;
        }

        if (import.meta.env.DEV) {
          const errors = [
            budgetsRes.error,
            expensesRes.error,
            categoriesRes.error,
            goalsRes.error,
            recurringBillsRes.error,
          ].filter(Boolean);
          if (errors.length > 0) {
            console.warn(
              "[finance] loadFromSupabase Supabase errors (check RLS/schema)",
              errors.map((e) => e!.message),
            );
          }
        }

        const budgetsMap: Record<string, BudgetMonth> = {};
        ((budgetsRes.data as BudgetMonthRow[] | null) ?? []).forEach((row) => {
          budgetsMap[row.month] = {
            id: row.id,
            month: row.month,
            salaryCents: row.salary_cents,
            currency: row.currency ?? "EUR",
            createdAt: row.created_at,
            incomeNote: row.income_note ?? undefined,
          };
        });

        const expenses: Expense[] = (((expensesRes.data as ExpenseRow[] | null) ?? []).map((row) => ({
          id: row.id,
          budgetMonthId: row.budget_month_id,
          month: row.month,
          amountCents: row.amount_cents,
          category: row.category,
          date: row.date,
          note: row.note ?? "",
          createdAt: row.created_at,
        })));

        const customCategories: CategoryDef[] = [];
        const categoryLimits: CategoryLimitsByMonth = {};
        const defaultCategoryValues = new Set(DEFAULT_CATEGORIES.map((c) => c.value));

        ((categoriesRes.data as CategoryRow[] | null) ?? []).forEach((row) => {
          const isStandaloneCustomRow =
            row.month == null &&
            row.limit_cents == null &&
            !defaultCategoryValues.has(row.value);

          if (row.is_custom || isStandaloneCustomRow) {
            customCategories.push({
              id: row.id,
              value: row.value,
              label: row.label,
              iconKey: row.icon_key ?? DEFAULT_CATEGORY_ICON_KEY,
              isCustom: true,
            });
          }

          const limitCents = parseLimitCents(row.limit_cents);
          if (row.month && limitCents != null && limitCents > 0) {
            categoryLimits[row.month] = categoryLimits[row.month] ?? {};
            categoryLimits[row.month][row.value] = limitCents;
          }
        });

        const localCategoryLimits = readCategoryLimitsFromLocal(userId);

        const savingsGoals: SavingsGoal[] = (((goalsRes.data as GoalRow[] | null) ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          targetCents: row.target_cents,
          savedCents: row.saved_cents,
          startDate: row.start_date,
          targetDate: row.target_date,
          createdAt: row.created_at,
        })));

        const recurringBillsFromDb: RecurringBill[] = (((recurringBillsRes.data as RecurringBillRow[] | null) ?? []).map(
          (row) => ({
            id: row.id,
            userId: row.user_id,
            name: row.name,
            amountCents: row.amount_cents,
            category: row.category,
            dueDay: row.due_day,
            frequency: row.frequency,
            status: row.status,
            lastPaidDate: row.last_paid_date ?? undefined,
            nextDueDate: normalizeStoredBillNextDueDate(
              row.next_due_date,
              row.due_day,
              new Date(),
              formatSupabaseDateCellToIso(row.series_start_date),
            ),
            seriesStartDate: formatSupabaseDateCellToIso(row.series_start_date) ?? undefined,
            paymentCount: row.payment_count ?? undefined,
            paymentsCompleted: row.payments_completed ?? 0,
            note: row.note ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }),
        ));
        const localRecurringBills = readRecurringBillsFromLocal(userId);
        const shouldFallback = isRecurringBillsSchemaError(recurringBillsRes.error?.message);
        const remoteBillIds = new Set(recurringBillsFromDb.map((bill) => bill.id));
        const localOnlyCount = shouldFallback
          ? localRecurringBills.length
          : localRecurringBills.filter((bill) => !remoteBillIds.has(bill.id)).length;

        if (!shouldFallback && hasSupabaseEnv && localOnlyCount > 0) {
          await migrateLocalOnlyRecurringBills(userId, localRecurringBills, remoteBillIds);
        }

        const recurringBills = shouldFallback
          ? localRecurringBills
          : (() => {
              const merged = [...recurringBillsFromDb];
              const ids = new Set(merged.map((bill) => bill.id));
              localRecurringBills.forEach((localBill) => {
                if (!ids.has(localBill.id)) {
                  merged.push(localBill);
                }
              });
              return merged;
            })();

        const localPendingExpenses = readPendingExpensesFromLocal(userId);
        const pendingAsExpenses: Expense[] = localPendingExpenses.map((item) => ({
          id: item.id,
          budgetMonthId: "",
          month: item.month,
          amountCents: item.amountCents,
          category: item.category,
          date: item.date,
          note: item.note,
          createdAt: item.createdAt,
        }));

        if (generation !== financeLoadGenerationRef.current) {
          return;
        }

        setUseRecurringBillsLocalFallback(shouldFallback);
        setLocalOnlyRecurringBillsCount(localOnlyCount);
        setPendingExpenses(localPendingExpenses);

        setData({
          budgets: budgetsMap,
          expenses: [...expenses, ...pendingAsExpenses],
          customCategories,
          savingsGoals,
          categoryLimits: mergeCategoryLimits(categoryLimits, localCategoryLimits),
          recurringBills,
        });
        if (import.meta.env.DEV) {
          console.debug("[finance] loaded recurring bills", recurringBills.length, "from remote/local merge");
        }
      } finally {
        if (generation === financeLoadGenerationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (isDemoMode) {
      setData(buildDemoFinanceData());
      setIsLoading(false);
      setPendingExpenses([]);
      setUseRecurringBillsLocalFallback(false);
      return;
    }

    if (!hasSupabaseEnv) {
      if (!user) {
        setData(initialData);
        setIsLoading(false);
        return;
      }
      setData({
        ...initialData,
        recurringBills: readRecurringBillsFromLocal(user.id),
        categoryLimits: readCategoryLimitsFromLocal(user.id),
      });
      setIsLoading(false);
      if (import.meta.env.DEV) {
        console.debug(
          "[finance] local-only load",
          "recurringBills",
          readRecurringBillsFromLocal(user.id).length,
        );
      }
      return;
    }

    if (!user) {
      setData(initialData);
      setIsLoading(false);
      return;
    }

    const ac = new AbortController();
    void loadFromSupabase(user.id, { signal: ac.signal, showLoading: true });

    return () => {
      ac.abort();
    };
  }, [isDemoMode, user?.id, loadFromSupabase]);

  useEffect(() => {
    if (isDemoMode) return;
    if (!user || !hasSupabaseEnv) return;

    const syncPending = async () => {
      const queue = readPendingExpensesFromLocal(user.id);
      if (!queue.length || !navigator.onLine) return;

      const remaining: PendingExpenseItem[] = [];
      const syncedExpenses: Expense[] = [];
      for (const item of queue) {
        const budgetForMonth = data.budgets[item.month];
        const budgetId = budgetForMonth?.id ?? crypto.randomUUID();
        const upsertBudget = await supabase.from("budget_months").upsert(
          {
            id: budgetId,
            user_id: user.id,
            month: item.month,
            salary_cents: budgetForMonth?.salaryCents ?? 0,
            currency: budgetForMonth?.currency ?? "EUR",
            income_note: budgetForMonth?.incomeNote ?? null,
          },
          { onConflict: "user_id,month" },
        );

        if (upsertBudget.error) {
          remaining.push(item);
          continue;
        }

        const resolvedBudget = await supabase
          .from("budget_months")
          .select("id")
          .eq("user_id", user.id)
          .eq("month", item.month)
          .maybeSingle();

        if (resolvedBudget.error || !resolvedBudget.data?.id) {
          remaining.push(item);
          continue;
        }

        const syncedId = crypto.randomUUID();
        const insertExpense = await supabase.from("expenses").insert({
          id: syncedId,
          user_id: user.id,
          budget_month_id: resolvedBudget.data.id,
          month: item.month,
          amount_cents: item.amountCents,
          category: item.category,
          date: item.date,
          note: item.note?.trim() ? item.note : null,
        });

        if (insertExpense.error) {
          remaining.push(item);
          continue;
        }
        syncedExpenses.push({
          id: syncedId,
          budgetMonthId: resolvedBudget.data.id,
          month: item.month,
          amountCents: item.amountCents,
          category: item.category,
          date: item.date,
          note: item.note,
          createdAt: item.createdAt,
        });
      }

      writePendingExpensesToLocal(user.id, remaining);
      setPendingExpenses(remaining);
      if (remaining.length !== queue.length) {
        setData((prev) => ({
          ...prev,
          expenses: [
            ...prev.expenses.filter((expense) => !queue.some((item) => item.id === expense.id)),
            ...syncedExpenses,
          ],
        }));
      }
    };

    void syncPending();
    const onOnline = () => {
      void syncPending();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [data.budgets, isDemoMode, user]);

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...data.customCategories],
    [data.customCategories],
  );

  const getMonthData = useCallback(
    (month: string): MonthData => {
      const budget = data.budgets[month] || null;
      const expenses = data.expenses.filter((exp) => exp.month === month);
      return { budget, expenses };
    },
    [data],
  );

  const currentMonthData = getMonthData(currentMonth);
  const incomeCycleConfigured = isIncomeCycleConfigured(incomeCycle);

  const selectedCycle = useMemo(() => {
    if (isDemoMode) return null;
    return (
      findCycleForMonthKey(budgetCycles, currentMonth) ??
      budgetCycles.find((c) => c.status === "active") ??
      null
    );
  }, [budgetCycles, currentMonth, isDemoMode]);

  const previousCycle = useMemo(
    () => (selectedCycle ? findPreviousCycle(budgetCycles, selectedCycle) : null),
    [budgetCycles, selectedCycle],
  );

  const cycleIncome = useCycleIncome(
    !isDemoMode && user ? user.id : undefined,
    selectedCycle?.id,
  );
  const previousCycleIncome = useCycleIncome(
    !isDemoMode && user ? user.id : undefined,
    previousCycle?.id,
  );

  const totalIncomeThisCycleCents = isDemoMode
    ? (currentMonthData.budget?.salaryCents ?? 0)
    : cycleIncome.totalIncomeCents;
  const hasIncomeForCycle = isDemoMode
    ? totalIncomeThisCycleCents > 0
    : cycleIncome.hasIncomeForCycle;
  const previousCycleIncomeCents = isDemoMode
    ? (data.budgets[getPreviousMonth(currentMonth)]?.salaryCents ?? 0)
    : previousCycleIncome.totalIncomeCents;

  /** Display budget: salaryCents is derived from income_entries (not a write source). */
  const effectiveBudget = useMemo(() => {
    const base = currentMonthData.budget;
    if (isDemoMode) return base;
    if (!base) {
      if (!hasIncomeForCycle && !selectedCycle) return null;
      return {
        id: selectedCycle?.id ?? `cycle-${currentMonth}`,
        month: currentMonth,
        salaryCents: totalIncomeThisCycleCents,
        currency: "EUR",
        createdAt: selectedCycle?.createdAt ?? new Date().toISOString(),
      };
    }
    return { ...base, salaryCents: totalIncomeThisCycleCents };
  }, [
    currentMonth,
    currentMonthData.budget,
    hasIncomeForCycle,
    isDemoMode,
    selectedCycle,
    totalIncomeThisCycleCents,
  ]);

  const updateMonthlyIncome = useCallback(
    async (
      month: string,
      salaryCents: number,
      incomeNote?: string,
      currencyOverride?: string,
      meta?: { source?: IncomeWriteSource },
    ) => {
      if (isDemoMode) {
        toast.info("Sample budget", { description: DEMO_EDIT_MESSAGE });
        return;
      }
      if (!user) return;

      const existingSalaryCents = data.budgets[month]?.salaryCents ?? 0;
      const isCurrencyOnly = meta?.source === "currency_only";
      if (!isCurrencyOnly && !canWriteMonthlyIncome(meta?.source)) {
        salaryCents = warnBlockedIncomeWrite(
          meta?.source ?? "updateMonthlyIncome",
          salaryCents,
          existingSalaryCents,
        );
      }

      let dbId: string | null = null;
      let dbCurrency: string | null = null;

      if (hasSupabaseEnv) {
        const { data: existingRow } = await supabase
          .from("budget_months")
          .select("id, currency")
          .eq("user_id", user.id)
          .eq("month", month)
          .maybeSingle();
        if (existingRow?.id) {
          dbId = existingRow.id;
          dbCurrency = existingRow.currency;
        }
      }

      let snapshot: BudgetMonth | null = null;

      setData((prev) => {
        const existingBudget = prev.budgets[month];
        const rowId = dbId ?? existingBudget?.id ?? crypto.randomUUID();
        const resolvedCurrency = normalizeCurrencyCode(
          currencyOverride ?? existingBudget?.currency ?? dbCurrency ?? "EUR",
        );
        const updatedBudget: BudgetMonth = existingBudget
          ? { ...existingBudget, id: rowId, salaryCents, incomeNote, currency: resolvedCurrency }
          : {
              id: rowId,
              month,
              salaryCents,
              currency: resolvedCurrency,
              createdAt: new Date().toISOString(),
              incomeNote,
            };
        snapshot = updatedBudget;
        return { ...prev, budgets: { ...prev.budgets, [month]: updatedBudget } };
      });

      if (!hasSupabaseEnv || !snapshot) return;

      const budgetUpsert = await supabase.from("budget_months").upsert(
        {
          id: snapshot.id,
          user_id: user.id,
          month,
          salary_cents: salaryCents,
          currency: snapshot.currency,
          income_note: incomeNote ?? null,
        },
        { onConflict: "user_id,month" },
      );

      if (budgetUpsert.error) {
        throw new Error(budgetUpsert.error.message);
      }

      const incomeUpsert = await supabase.from("income_history").upsert(
        {
          user_id: user.id,
          month,
          salary_cents: salaryCents,
          income_note: incomeNote ?? null,
        },
        { onConflict: "user_id,month" },
      );

      if (incomeUpsert.error) {
        throw new Error(incomeUpsert.error.message);
      }
    },
    [data.budgets, isDemoMode, user],
  );

  const setCurrency = useCallback(
    (currency: string) => {
      if (isDemoMode) {
        toast.info("Sample budget", { description: DEMO_EDIT_MESSAGE });
        return;
      }
      if (!user) return;
      const budget = data.budgets[currentMonth];
      void updateMonthlyIncome(
        currentMonth,
        budget?.salaryCents ?? 0,
        budget?.incomeNote,
        currency,
        { source: "currency_only" },
      );
    },
    [currentMonth, data.budgets, isDemoMode, updateMonthlyIncome, user],
  );

  const setSalary = useCallback(
    async (salaryCents: number, incomeNote?: string) => {
      if (isDemoMode) {
        toast.info("Sample budget", { description: DEMO_EDIT_MESSAGE });
        return;
      }
      if (!user || !hasSupabaseEnv) return;

      let cycle = selectedCycle;
      if (!cycle) {
        const cycles = await ensureCyclesUpToToday({ userId: user.id, incomeCycle });
        setBudgetCycles(cycles);
        cycle =
          findCycleForMonthKey(cycles, currentMonth) ??
          cycles.find((c) => c.status === "active") ??
          null;
      }
      if (!cycle) {
        toast.error("Could not save income", {
          description: "No budget cycle is available yet. Try again in a moment.",
        });
        return;
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const receivedDate = isDateInBudgetCycle(today, cycle) ? today : cycle.startDate;

      await runWithIncomeWrite("user_edit", async () => {
        await cycleIncome.addIncome.mutateAsync({
          amountCents: salaryCents,
          receivedDate,
          source: "salary",
          note: incomeNote ?? null,
        });
      });
    },
    [
      currentMonth,
      cycleIncome.addIncome,
      incomeCycle,
      isDemoMode,
      selectedCycle,
      user,
    ],
  );

  const addExpense = useCallback(
    async (expense: Omit<Expense, "id" | "createdAt" | "budgetMonthId" | "month">) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not authenticated");
      }
      const budget = data.budgets[currentMonth];
      const budgetId = budget?.id ?? crypto.randomUUID();
      const newExpenseId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      let newExpense: Expense | null = null;
      try {
        const { error: budgetError } = await supabase.from("budget_months").upsert(
          {
            id: budgetId,
            user_id: user.id,
            month: currentMonth,
            salary_cents: budget?.salaryCents ?? 0,
            currency: budget?.currency ?? "EUR",
            income_note: budget?.incomeNote ?? null,
          },
          { onConflict: "user_id,month" },
        );

        if (budgetError) {
          throw new Error(budgetError.message);
        }

        const { data: resolvedBudget, error: resolveBudgetError } = await supabase
          .from("budget_months")
          .select("id")
          .eq("user_id", user.id)
          .eq("month", currentMonth)
          .maybeSingle();

        if (resolveBudgetError) {
          throw new Error(resolveBudgetError.message);
        }
        if (!resolvedBudget?.id) {
          throw new Error("Could not resolve budget month after save");
        }

        const resolvedBudgetId = resolvedBudget.id;

        const { error: expenseError } = await supabase.from("expenses").insert({
          id: newExpenseId,
          user_id: user.id,
          budget_month_id: resolvedBudgetId,
          month: currentMonth,
          amount_cents: expense.amountCents,
          category: expense.category,
          date: expense.date,
          note: expense.note?.trim() ? expense.note : null,
        });

        if (expenseError) {
          throw new Error(expenseError.message);
        }

        newExpense = {
          ...expense,
          id: newExpenseId,
          budgetMonthId: resolvedBudgetId,
          month: currentMonth,
          createdAt,
        };
      } catch {
        const offlineExpense: PendingExpenseItem = {
          id: `offline-${newExpenseId}`,
          amountCents: expense.amountCents,
          category: expense.category,
          date: expense.date,
          note: expense.note,
          month: currentMonth,
          createdAt,
        };
        const nextPending = [...pendingExpenses, offlineExpense];
        setPendingExpenses(nextPending);
        writePendingExpensesToLocal(user.id, nextPending);
        newExpense = {
          ...offlineExpense,
          budgetMonthId: "",
        };
      }

      setData((prev) => ({
        ...prev,
        budgets: prev.budgets[currentMonth]
          ? prev.budgets
          : {
              ...prev.budgets,
              [currentMonth]: {
                id: resolvedBudgetId,
                month: currentMonth,
                salaryCents: budget?.salaryCents ?? 0,
                currency: budget?.currency ?? "EUR",
                createdAt,
                incomeNote: budget?.incomeNote,
              },
            },
        expenses: [...prev.expenses, newExpense as Expense],
      }));

      return newExpense;
    },
    [currentMonth, data.budgets, isDemoMode, pendingExpenses, user],
  );

  const updateExpense = useCallback(
    async (id: string, updates: Partial<Omit<Expense, "id" | "createdAt" | "budgetMonthId" | "month">>) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not authenticated");
      }

      const patch: Record<string, unknown> = {};
      if (updates.amountCents !== undefined) patch.amount_cents = updates.amountCents;
      if (updates.category !== undefined) patch.category = updates.category;
      if (updates.note !== undefined) patch.note = updates.note?.trim() ? updates.note : null;

      if (updates.date !== undefined) {
        const newMonth = budgetMonthKeyForDate(updates.date, incomeCycle);
        patch.date = updates.date;

        const { data: existingRow, error: existingError } = await supabase
          .from("expenses")
          .select("month")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingError) {
          throw new Error(existingError.message);
        }
        if (!existingRow) {
          throw new Error("Expense not found or access denied");
        }

        const existingMonthNorm = existingRow.month ? normalizeYearMonthYm(String(existingRow.month)) : "";
        if (newMonth !== existingMonthNorm) {
          patch.month = newMonth;

          const budget = data.budgets[newMonth];
          const budgetId = budget?.id ?? crypto.randomUUID();
          const fallbackCurrency =
            budget?.currency ??
            normalizeCurrencyCode(Object.values(data.budgets)[0]?.currency) ??
            "EUR";

          const { error: budgetError } = await supabase.from("budget_months").upsert(
            {
              id: budgetId,
              user_id: user.id,
              month: newMonth,
              salary_cents: budget?.salaryCents ?? 0,
              currency: fallbackCurrency,
              income_note: budget?.incomeNote ?? null,
            },
            { onConflict: "user_id,month" },
          );

          if (budgetError) {
            throw new Error(budgetError.message);
          }

          const { data: resolvedBudget, error: resolveBudgetError } = await supabase
            .from("budget_months")
            .select("id")
            .eq("user_id", user.id)
            .eq("month", newMonth)
            .maybeSingle();

          if (resolveBudgetError) {
            throw new Error(resolveBudgetError.message);
          }
          if (!resolvedBudget?.id) {
            throw new Error("Could not resolve budget month after save");
          }

          patch.budget_month_id = resolvedBudget.id;
        }
      }

      if (Object.keys(patch).length === 0) {
        return;
      }

      const { data: row, error } = await supabase
        .from("expenses")
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, budget_month_id, month, amount_cents, category, date, note, created_at")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!row) {
        throw new Error("Expense not found or access denied");
      }

      const rowMonthKey = row.month ? normalizeYearMonthYm(String(row.month)) : "";

      setData((prev) => {
        const nextBudgets = { ...prev.budgets };
        if (updates.date !== undefined && rowMonthKey && !nextBudgets[rowMonthKey]) {
          const template = Object.values(prev.budgets)[0];
          nextBudgets[rowMonthKey] = {
            id: row.budget_month_id,
            month: rowMonthKey,
            salaryCents: 0,
            currency: template?.currency ?? "EUR",
            createdAt: new Date().toISOString(),
          };
        }

        return {
          ...prev,
          budgets: nextBudgets,
          expenses: prev.expenses.map((exp) => {
            if (exp.id !== id) return exp;
            const nextCategory =
              row.category != null && String(row.category).trim() !== "" ? row.category : exp.category;
            return {
              ...exp,
              amountCents: row.amount_cents,
              category: nextCategory,
              date: row.date,
              month: rowMonthKey || exp.month,
              note: row.note ?? "",
              budgetMonthId: row.budget_month_id,
              createdAt: row.created_at,
            };
          }),
        };
      });

      // If the edit moved the expense into a different budget month than the one
      // being viewed, follow it there so it never silently disappears from the
      // list. When an income cycle is configured, a date inside the current
      // cycle resolves to the same month key above, so no navigation happens.
      if (rowMonthKey && rowMonthKey !== currentMonth) {
        setCurrentMonth(rowMonthKey);
      }
    },
    [isDemoMode, user, data.budgets, incomeCycle, currentMonth, setCurrentMonth],
  );

  const deleteExpense = useCallback(async (id: string) => {
    if (isDemoMode) {
      throw new Error(DEMO_EDIT_MESSAGE);
    }
    if (!user) {
      throw new Error("Not authenticated");
    }

    const { data: rows, error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      throw new Error(error.message);
    }
    if (!rows?.length) {
      throw new Error("Expense not found or access denied");
    }

    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((exp) => exp.id !== id),
    }));
  }, [isDemoMode, user]);

  const addRecurringBill = useCallback(
    async (
      bill: Omit<RecurringBill, "id" | "userId" | "createdAt" | "updatedAt" | "lastPaidDate"> & {
        lastPaidDate?: string;
      },
    ) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not authenticated");
      }

      const newBill: RecurringBill = {
        ...bill,
        id: crypto.randomUUID(),
        userId: user.id,
        lastPaidDate: bill.lastPaidDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!hasSupabaseEnv) {
        setData((prev) => {
          const nextBills = [...prev.recurringBills, newBill];
          writeRecurringBillsToLocal(user.id, nextBills);
          if (import.meta.env.DEV) {
            console.debug("[finance] recurring bill saved (local only)", newBill.name, nextBills.length);
          }
          return { ...prev, recurringBills: nextBills };
        });
        return newBill;
      }

      if (useRecurringBillsLocalFallback) {
        setData((prev) => {
          const nextBills = [...prev.recurringBills, newBill];
          writeRecurringBillsToLocal(user.id, nextBills);
          if (import.meta.env.DEV) {
            console.debug("[finance] recurring bill saved (local fallback)", newBill.name, nextBills.length);
          }
          return { ...prev, recurringBills: nextBills };
        });
        return newBill;
      }

      const { error } = await supabase
        .from("recurring_bills")
        .insert(recurringBillToSupabaseRow(newBill, user.id));

      if (error) {
        if (import.meta.env.DEV) {
          console.debug("[finance] recurring bill insert error", {
            name: newBill.name,
            message: error.message,
            details: (error as { details?: string }).details,
            hint: (error as { hint?: string }).hint,
            code: (error as { code?: string }).code,
          });
        }
        if (isRecurringBillsSchemaError(error.message)) {
          setUseRecurringBillsLocalFallback(true);
          setData((prev) => {
            const nextBills = [...prev.recurringBills, newBill];
            writeRecurringBillsToLocal(user.id, nextBills);
            if (import.meta.env.DEV) {
              console.debug("[finance] recurring bill saved (schema fallback)", newBill.name, nextBills.length);
            }
            return { ...prev, recurringBills: nextBills };
          });
          return newBill;
        }
        throw new Error(error.message);
      }

      setData((prev) => {
        const nextBills = [...prev.recurringBills, newBill];
        writeRecurringBillsToLocal(user.id, nextBills);
        return { ...prev, recurringBills: nextBills };
      });

      if (import.meta.env.DEV) {
        console.debug("[finance] recurring bill saved (Supabase + local cache)", {
          name: newBill.name,
          amountCents: newBill.amountCents,
          nextDueDate: newBill.nextDueDate,
        });
      }

      return newBill;
    },
    [isDemoMode, useRecurringBillsLocalFallback, user],
  );

  const updateRecurringBill = useCallback(
    async (
      billId: string,
      updates: Partial<
        Pick<
          RecurringBill,
          | "name"
          | "amountCents"
          | "category"
          | "dueDay"
          | "frequency"
          | "status"
          | "nextDueDate"
          | "seriesStartDate"
          | "paymentCount"
          | "paymentsCompleted"
          | "note"
          | "lastPaidDate"
        >
      >,
    ) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not authenticated");
      }
      if (Object.keys(updates).length === 0) return;
      if (useRecurringBillsLocalFallback) {
        setData((prev) => {
          const nextBills = prev.recurringBills.map((bill) =>
            bill.id === billId ? { ...bill, ...updates, updatedAt: new Date().toISOString() } : bill,
          );
          writeRecurringBillsToLocal(user.id, nextBills);
          return { ...prev, recurringBills: nextBills };
        });
        return;
      }

      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.amountCents !== undefined) patch.amount_cents = updates.amountCents;
      if (updates.category !== undefined) patch.category = updates.category;
      if (updates.dueDay !== undefined) patch.due_day = updates.dueDay;
      if (updates.frequency !== undefined) patch.frequency = updates.frequency;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.nextDueDate !== undefined) patch.next_due_date = updates.nextDueDate;
      if (updates.seriesStartDate !== undefined) patch.series_start_date = updates.seriesStartDate ?? null;
      if (updates.paymentCount !== undefined) patch.payment_count = updates.paymentCount ?? null;
      if (updates.paymentsCompleted !== undefined) patch.payments_completed = updates.paymentsCompleted;
      if (updates.lastPaidDate !== undefined) patch.last_paid_date = updates.lastPaidDate;
      if (updates.note !== undefined) patch.note = updates.note?.trim() ? updates.note : null;
      patch.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("recurring_bills")
        .update(patch)
        .eq("id", billId)
        .eq("user_id", user.id);

      if (error) {
        if (isRecurringBillsSchemaError(error.message)) {
          setUseRecurringBillsLocalFallback(true);
          setData((prev) => {
            const nextBills = prev.recurringBills.map((bill) =>
              bill.id === billId ? { ...bill, ...updates, updatedAt: new Date().toISOString() } : bill,
            );
            writeRecurringBillsToLocal(user.id, nextBills);
            return { ...prev, recurringBills: nextBills };
          });
          return;
        }
        throw new Error(error.message);
      }

      setData((prev) => ({
        ...prev,
        recurringBills: prev.recurringBills.map((bill) =>
          bill.id === billId
            ? {
                ...bill,
                ...updates,
                updatedAt: String(patch.updated_at),
              }
            : bill,
        ),
      }));
    },
    [isDemoMode, useRecurringBillsLocalFallback, user],
  );

  const deleteRecurringBill = useCallback(
    async (billId: string) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not authenticated");
      }
      const removeBillFromState = () => {
        setData((prev) => {
          const nextBills = prev.recurringBills.filter((bill) => bill.id !== billId);
          writeRecurringBillsToLocal(user.id, nextBills);
          return { ...prev, recurringBills: nextBills };
        });
      };
      if (!hasSupabaseEnv || useRecurringBillsLocalFallback) {
        removeBillFromState();
        return;
      }
      const { error } = await supabase.from("recurring_bills").delete().eq("id", billId).eq("user_id", user.id);
      if (error) {
        if (isRecurringBillsSchemaError(error.message)) {
          setUseRecurringBillsLocalFallback(true);
          removeBillFromState();
          return;
        }
        throw new Error(error.message);
      }
      removeBillFromState();
    },
    [isDemoMode, useRecurringBillsLocalFallback, user],
  );

  const markRecurringBillPaid = useCallback(
    async (billId: string) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not authenticated");
      }
      const bill = data.recurringBills.find((item) => item.id === billId);
      if (!bill) {
        throw new Error("Bill not found");
      }

      const incomeCycleConfigured = isIncomeCycleConfigured(incomeCycle);
      const cycleWindow = incomeCycleConfigured
        ? getCycleWindowDatesForMonthKey(incomeCycle!, currentMonth)
        : null;
      const nextSalaryDate = incomeCycleConfigured
        ? format(cycleWindow!.end, "yyyy-MM-dd")
        : getDefaultNextIncomeDateForMonth(currentMonth);
      const monthStartIso = incomeCycleConfigured
        ? format(cycleWindow!.start, "yyyy-MM-dd")
        : `${currentMonth}-01`;
      const upcomingBeforePay = getUpcomingBills(
        data.recurringBills,
        nextSalaryDate,
        monthStartIso,
      );
      const wasBillReserved = isBillReservedInUpcoming(bill, upcomingBeforePay);
      const spentBefore = data.expenses
        .filter((exp) => exp.month === currentMonth)
        .reduce((sum, exp) => sum + exp.amountCents, 0);
      const upcomingCentsBefore = upcomingBeforePay.reduce((sum, item) => sum + item.amountCents, 0);
      const savingsCents = data.savingsGoals.reduce(
        (sum, goal) => sum + calculateGoalPlan(goal).monthlyRequiredSavingCents,
        0,
      );
      const safeToSpendBefore = computeSafeToSpendCents({
        incomeForCurrentCycleCents: totalIncomeThisCycleCents,
        spentSoFarCents: spentBefore,
        upcomingBillsBeforeIncomeDateCents: upcomingCentsBefore,
        savingsGoalsForCurrentCycleCents: savingsCents,
      });

      const nextPaymentsCompleted = (bill.paymentsCompleted ?? 0) + 1;
      const seriesComplete =
        bill.paymentCount != null && nextPaymentsCompleted >= bill.paymentCount;
      const nextDueDate = seriesComplete
        ? bill.nextDueDate
        : getNextDateForFrequency(bill.nextDueDate, bill.frequency);
      const nextStatus: BillStatus = seriesComplete ? "skipped" : "upcoming";
      const now = new Date().toISOString();
      const today = now.slice(0, 10);

      const budget = data.budgets[currentMonth];
      const budgetId = budget?.id ?? crypto.randomUUID();
      const newExpenseId = crypto.randomUUID();
      const createdAt = now;
      const expensePayload = {
        amountCents: bill.amountCents,
        category: bill.category,
        date: bill.nextDueDate,
        note: `Paid recurring bill: ${bill.name}${bill.note ? ` — ${bill.note}` : ""}`,
      };
      const optimisticExpense: Expense = {
        ...expensePayload,
        id: newExpenseId,
        budgetMonthId: budgetId,
        month: currentMonth,
        createdAt,
      };

      setData((prev) => {
        const nextBills = prev.recurringBills.map((item) =>
          item.id === billId
            ? {
                ...item,
                status: nextStatus,
                lastPaidDate: today,
                nextDueDate,
                paymentsCompleted: nextPaymentsCompleted,
                updatedAt: now,
              }
            : item,
        );
        writeRecurringBillsToLocal(user.id, nextBills);
        return {
          ...prev,
          budgets: prev.budgets[currentMonth]
            ? prev.budgets
            : {
                ...prev.budgets,
                [currentMonth]: {
                  id: budgetId,
                  month: currentMonth,
                  salaryCents: budget?.salaryCents ?? 0,
                  currency: budget?.currency ?? "EUR",
                  createdAt,
                  incomeNote: budget?.incomeNote,
                },
              },
          expenses: [...prev.expenses, optimisticExpense],
          recurringBills: nextBills,
        };
      });

      const upcomingAfterPay = getUpcomingBills(
        data.recurringBills.map((item) =>
          item.id === billId
            ? {
                ...item,
                status: nextStatus,
                lastPaidDate: today,
                nextDueDate,
                paymentsCompleted: nextPaymentsCompleted,
                updatedAt: now,
              }
            : item,
        ),
        nextSalaryDate,
        monthStartIso,
      );
      const safeToSpendAfter = computeSafeToSpendCents({
        incomeForCurrentCycleCents: totalIncomeThisCycleCents,
        spentSoFarCents: spentBefore + bill.amountCents,
        upcomingBillsBeforeIncomeDateCents: upcomingAfterPay.reduce(
          (sum, item) => sum + item.amountCents,
          0,
        ),
        savingsGoalsForCurrentCycleCents: savingsCents,
      });

      logBillPaymentDebug({
        billId: bill.id,
        billName: bill.name,
        billAmountCents: bill.amountCents,
        wasBillReserved,
        safeToSpendBefore,
        safeToSpendAfter,
        paid: true,
        expensesTotalAfter: spentBefore + bill.amountCents,
      });

      try {
        const { error: budgetError } = await supabase.from("budget_months").upsert(
          {
            id: budgetId,
            user_id: user.id,
            month: currentMonth,
            salary_cents: budget?.salaryCents ?? 0,
            currency: budget?.currency ?? "EUR",
            income_note: budget?.incomeNote ?? null,
          },
          { onConflict: "user_id,month" },
        );
        if (budgetError) {
          throw new Error(budgetError.message);
        }

        const { data: resolvedBudget, error: resolveBudgetError } = await supabase
          .from("budget_months")
          .select("id")
          .eq("user_id", user.id)
          .eq("month", currentMonth)
          .maybeSingle();
        if (resolveBudgetError) {
          throw new Error(resolveBudgetError.message);
        }
        if (!resolvedBudget?.id) {
          throw new Error("Could not resolve budget month after save");
        }

        const { error: expenseError } = await supabase.from("expenses").insert({
          id: newExpenseId,
          user_id: user.id,
          budget_month_id: resolvedBudget.id,
          month: currentMonth,
          amount_cents: expensePayload.amountCents,
          category: expensePayload.category,
          date: expensePayload.date,
          note: expensePayload.note?.trim() ? expensePayload.note : null,
        });
        if (expenseError) {
          throw new Error(expenseError.message);
        }

        setData((prev) => ({
          ...prev,
          expenses: prev.expenses.map((exp) =>
            exp.id === newExpenseId
              ? { ...exp, budgetMonthId: resolvedBudget.id }
              : exp,
          ),
        }));
      } catch (expensePersistError) {
        const offlineExpense: PendingExpenseItem = {
          id: `offline-${newExpenseId}`,
          amountCents: expensePayload.amountCents,
          category: expensePayload.category,
          date: expensePayload.date,
          note: expensePayload.note,
          month: currentMonth,
          createdAt,
        };
        const nextPending = [...pendingExpenses, offlineExpense];
        setPendingExpenses(nextPending);
        writePendingExpensesToLocal(user.id, nextPending);
        setData((prev) => ({
          ...prev,
          expenses: prev.expenses.map((exp) =>
            exp.id === newExpenseId
              ? { ...offlineExpense, budgetMonthId: "" }
              : exp,
          ),
        }));
        if (expensePersistError instanceof Error && hasSupabaseEnv) {
          console.warn("Bill expense saved offline:", expensePersistError.message);
        }
      }

      if (!useRecurringBillsLocalFallback) {
        const { error } = await supabase
          .from("recurring_bills")
          .update({
            status: nextStatus,
            last_paid_date: today,
            next_due_date: nextDueDate,
            payments_completed: nextPaymentsCompleted,
            updated_at: now,
          })
          .eq("id", billId)
          .eq("user_id", user.id);

        if (error) {
          if (isRecurringBillsSchemaError(error.message)) {
            setUseRecurringBillsLocalFallback(true);
          } else {
            throw new Error(error.message);
          }
        }
      }
    },
    [
      currentMonth,
      data.budgets,
      data.expenses,
      data.recurringBills,
      data.savingsGoals,
      incomeCycle,
      isDemoMode,
      pendingExpenses,
      totalIncomeThisCycleCents,
      useRecurringBillsLocalFallback,
      user,
    ],
  );

  const addCustomCategory = useCallback(
    async (
      label: string,
      iconKeyInput?: string,
    ): Promise<{ success: true } | { success: false; error: string }> => {
      if (isDemoMode) return { success: false, error: DEMO_EDIT_MESSAGE };
      if (!user) return { success: false, error: "Not signed in" };
      const trimmedLabel = label.trim();
      const value = trimmedLabel
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      if (!value) return { success: false, error: "Invalid category name" };

      const exists = [...DEFAULT_CATEGORIES, ...data.customCategories].some(
        (c) => c.value === value || c.label.trim().toLowerCase() === trimmedLabel.toLowerCase(),
      );
      if (exists) return { success: false, error: "A category with this name already exists" };

      const newCategory: CategoryDef = {
        id: crypto.randomUUID(),
        value,
        label: trimmedLabel,
        iconKey: iconKeyInput && iconKeyInput.length > 0 ? iconKeyInput : inferIconKeyFromLabel(trimmedLabel),
        isCustom: true,
      };

      const { error } = await supabase.from("categories").insert({
        id: newCategory.id,
        user_id: user.id,
        value: newCategory.value,
        label: newCategory.label,
        icon_key: newCategory.iconKey,
        is_custom: true,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setData((prev) => ({
        ...prev,
        customCategories: [...prev.customCategories, newCategory],
      }));
      return { success: true };
    },
    [data.customCategories, isDemoMode, user],
  );

  const removeCustomCategory = useCallback(
    (value: string) => {
      if (isDemoMode) return;
      if (!user) return;
      setData((prev) => ({
        ...prev,
        customCategories: prev.customCategories.filter((c) => c.value !== value),
      }));
      void supabase
        .from("categories")
        .delete()
        .eq("user_id", user.id)
        .eq("value", value)
        .is("month", null);
    },
    [isDemoMode, user],
  );

  const deleteCategory = useCallback(
    (categoryValue: string): { success: true } | { success: false; error: string } => {
      if (isDemoMode) return { success: false, error: DEMO_EDIT_MESSAGE };
      const cat = allCategories.find((c) => c.value === categoryValue);
      if (!cat) return { success: false, error: "Category not found" };
      if (!cat.isCustom) return { success: false, error: "Default category can't be removed" };
      const inUse = data.expenses.some((exp) => exp.category === categoryValue);
      if (inUse) return { success: false, error: "Category is in use" };
      removeCustomCategory(categoryValue);
      return { success: true };
    },
    [allCategories, data.expenses, isDemoMode, removeCustomCategory],
  );

  const categoryLimitsForMonth = data.categoryLimits[currentMonth] || {};

  const setCategoryLimit = useCallback(
    (categoryValue: string, limitCents: number) => {
      if (!isDemoMode && !user) return;

      let nextCategoryLimits: CategoryLimitsByMonth | undefined;
      setData((prev) => {
        const { nextData, nextCategoryLimits: nextLimits } = applyCategoryLimitUpdate(
          prev,
          currentMonth,
          categoryValue,
          limitCents,
        );
        nextCategoryLimits = nextLimits;
        return nextData;
      });

      if (isDemoMode) {
        return;
      }

      if (!user || !nextCategoryLimits) return;

      writeCategoryLimitsToLocal(user.id, nextCategoryLimits);

      if (!hasSupabaseEnv) return;

      const categoryMeta = allCategories.find((c) => c.value === categoryValue);
      const label = categoryMeta?.label ?? categoryValue;
      const iconKey = categoryMeta?.iconKey ?? DEFAULT_CATEGORY_ICON_KEY;

      void (async () => {
        const persistUpdate = async (rowId: string) => {
          const { error } = await supabase
            .from("categories")
            .update({
              limit_cents: limitCents,
              label,
              icon_key: iconKey,
              month: currentMonth,
            })
            .eq("id", rowId)
            .eq("user_id", user.id);
          if (error) {
            toast.error("Could not save limit", { description: error.message });
          }
        };

        if (limitCents <= 0) {
          const { error } = await supabase
            .from("categories")
            .delete()
            .eq("user_id", user.id)
            .eq("value", categoryValue)
            .eq("month", currentMonth);
          if (error) {
            toast.error("Could not clear limit", { description: error.message });
          }
          return;
        }

        const { data: existingRows, error: selectError } = await supabase
          .from("categories")
          .select("id")
          .eq("user_id", user.id)
          .eq("value", categoryValue)
          .eq("month", currentMonth)
          .limit(1);

        if (selectError) {
          toast.error("Could not save limit", { description: selectError.message });
          return;
        }

        const existingId = existingRows?.[0]?.id;
        if (existingId) {
          await persistUpdate(existingId);
          return;
        }

        const rowId = crypto.randomUUID();
        const { error: insertError } = await supabase.from("categories").insert({
          id: rowId,
          user_id: user.id,
          value: categoryValue,
          label,
          icon_key: iconKey,
          is_custom: false,
          month: currentMonth,
          limit_cents: limitCents,
        });

        if (!insertError) {
          return;
        }

        // Row may already exist (e.g. race or unique index); fall back to update by keys.
        if (insertError.code === "23505") {
          const { data: conflictRows, error: conflictSelectError } = await supabase
            .from("categories")
            .select("id")
            .eq("user_id", user.id)
            .eq("value", categoryValue)
            .eq("month", currentMonth)
            .limit(1);

          if (conflictSelectError) {
            toast.error("Could not save limit", { description: conflictSelectError.message });
            return;
          }

          const conflictId = conflictRows?.[0]?.id;
          if (conflictId) {
            await persistUpdate(conflictId);
            return;
          }
        }

        toast.error("Could not save limit", { description: insertError.message });
      })();
    },
    [allCategories, currentMonth, isDemoMode, user],
  );

  const totalSpentCents = useMemo(() => {
    if (selectedCycle) {
      return data.expenses
        .filter((exp) => isDateInBudgetCycle(exp.date, selectedCycle))
        .reduce((sum, exp) => sum + exp.amountCents, 0);
    }
    return currentMonthData.expenses.reduce((sum, exp) => sum + exp.amountCents, 0);
  }, [currentMonthData.expenses, data.expenses, selectedCycle]);

  const effectiveSalaryCents = totalIncomeThisCycleCents;
  const remainingIncomeCents = effectiveSalaryCents - totalSpentCents;
  const frozenCycleStartIso = selectedCycle?.startDate ?? null;
  const frozenCycleEndIso = selectedCycle?.endDate ?? null;
  const legacyCycleWindow =
    !selectedCycle && incomeCycleConfigured
      ? getCycleWindowDatesForMonthKey(incomeCycle!, currentMonth)
      : null;
  const nextSalaryDate =
    frozenCycleEndIso ??
    (legacyCycleWindow
      ? format(legacyCycleWindow.end, "yyyy-MM-dd")
      : getDefaultNextIncomeDateForMonth(currentMonth));
  const monthStartIso =
    frozenCycleStartIso ??
    (legacyCycleWindow ? format(legacyCycleWindow.start, "yyyy-MM-dd") : `${currentMonth}-01`);
  const upcomingBills = getUpcomingBills(data.recurringBills, nextSalaryDate, monthStartIso);
  const upcomingBillsBeforeNextSalary = upcomingBills;
  const upcomingUnpaidBillsCents = upcomingBillsBeforeNextSalary.reduce((sum, bill) => sum + bill.amountCents, 0);
  const savingsGoalAllocationCents = data.savingsGoals.reduce(
    (sum, goal) => sum + calculateGoalPlan(goal).monthlyRequiredSavingCents,
    0,
  );
  const safeToSpendCents = hasIncomeForCycle
    ? computeSafeToSpendCents({
        incomeForCurrentCycleCents: effectiveSalaryCents,
        spentSoFarCents: totalSpentCents,
        upcomingBillsBeforeIncomeDateCents: upcomingUnpaidBillsCents,
        savingsGoalsForCurrentCycleCents: savingsGoalAllocationCents,
      })
    : null;
  const remainingCents = safeToSpendCents;
  const hasAnyData =
    Object.keys(data.budgets).length > 0 ||
    data.expenses.length > 0 ||
    data.customCategories.length > 0 ||
    data.savingsGoals.length > 0 ||
    data.recurringBills.length > 0;

  const financeDiagnostics = useMemo<FinanceDiagnosticsSnapshot>(
    () => ({
      supabaseHost: getSupabaseProjectHost(),
      userId: financeUserId || null,
      currentMonth,
      monthSelectionSource,
      settingsSource,
      incomeCycleConfigured,
      cycleStart: frozenCycleStartIso,
      cycleEnd: frozenCycleEndIso,
      incomeCents: effectiveSalaryCents,
      spentCents: totalSpentCents,
      savingsCents: savingsGoalAllocationCents,
      billsCents: upcomingUnpaidBillsCents,
      settingsHydrated,
      recurringBillsCount: data.recurringBills.length,
      upcomingBillsCount: upcomingBills.length,
      localOnlyRecurringBillsCount,
    }),
    [
      currentMonth,
      currentMonthData.budget?.salaryCents,
      effectiveSalaryCents,
      frozenCycleEndIso,
      frozenCycleStartIso,
      data.recurringBills.length,
      financeUserId,
      incomeCycleConfigured,
      localOnlyRecurringBillsCount,
      monthSelectionSource,
      settingsHydrated,
      settingsSource,
      savingsGoalAllocationCents,
      totalSpentCents,
      upcomingBills.length,
      upcomingUnpaidBillsCents,
    ],
  );

  const getCurrentMonthIncome = useCallback(() => {
    return {
      month: currentMonth,
      salaryCents: totalIncomeThisCycleCents,
      incomeNote: cycleIncome.entries[0]?.note ?? undefined,
    };
  }, [currentMonth, cycleIncome.entries, totalIncomeThisCycleCents]);

  const getPreviousMonthIncome = useCallback(() => {
    const previousMonth = previousCycle
      ? budgetMonthKeyFromCycle(previousCycle)
      : getPreviousMonth(currentMonth);
    return {
      month: previousMonth,
      salaryCents: previousCycleIncomeCents,
      incomeNote: undefined,
    };
  }, [currentMonth, previousCycle, previousCycleIncomeCents]);

  const getIncomeDifference = useCallback(() => {
    const current = getCurrentMonthIncome();
    const previous = getPreviousMonthIncome();
    return {
      current,
      previous,
      differenceCents: current.salaryCents - previous.salaryCents,
    };
  }, [getCurrentMonthIncome, getPreviousMonthIncome]);

  const addSavingsGoal = useCallback(
    async (goal: Omit<SavingsGoal, "id" | "createdAt">) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not authenticated");
      }
      const newGoal: SavingsGoal = {
        ...goal,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setData((prev) => ({
        ...prev,
        savingsGoals: [...prev.savingsGoals, newGoal],
      }));

      if (!hasSupabaseEnv) {
        return newGoal;
      }

      const { error } = await supabase.from("goals").insert({
        id: newGoal.id,
        user_id: user.id,
        name: newGoal.name,
        target_cents: newGoal.targetCents,
        saved_cents: newGoal.savedCents,
        start_date: newGoal.startDate,
        target_date: newGoal.targetDate,
      });

      if (error) {
        throw new Error(error.message);
      }

      return newGoal;
    },
    [isDemoMode, user],
  );

  const updateSavingsGoal = useCallback(
    async (
      id: string,
      updates: Partial<Pick<SavingsGoal, "name" | "targetCents" | "savedCents" | "startDate" | "targetDate">>,
    ) => {
      if (isDemoMode) {
        toast.info("Sample budget", { description: DEMO_EDIT_MESSAGE });
        return;
      }
      if (!user) return;

      setData((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      }));

      if (!hasSupabaseEnv) return;

      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.targetCents !== undefined) patch.target_cents = updates.targetCents;
      if (updates.savedCents !== undefined) patch.saved_cents = updates.savedCents;
      if (updates.startDate !== undefined) patch.start_date = updates.startDate;
      if (updates.targetDate !== undefined) patch.target_date = updates.targetDate;

      if (Object.keys(patch).length === 0) return;

      const { error } = await supabase.from("goals").update(patch).eq("id", id).eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }
    },
    [isDemoMode, user],
  );

  const deleteSavingsGoal = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        toast.info("Sample budget", { description: DEMO_EDIT_MESSAGE });
        return;
      }
      if (!user) return;

      setData((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.filter((g) => g.id !== id),
      }));

      if (!hasSupabaseEnv) return;

      const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }
    },
    [isDemoMode, user],
  );

  const syncFromOnboarding = useCallback(
    async (onboarding: OnboardingData) => {
      if (isDemoMode) {
        throw new Error(DEMO_EDIT_MESSAGE);
      }
      if (!user) {
        throw new Error("Not signed in");
      }

      const merged = mergeOnboardingData(onboarding);

      if (import.meta.env.DEV) {
        console.debug("[onboarding sync] submitted fixed bills", onboarding.fixedBills);
        console.debug("[onboarding sync] merged fixed bills", merged.fixedBills);
        console.debug("[onboarding sync] monthly savings goal cents", merged.monthlySavingsGoalCents);
      }

      // 1) Income — create an income_entries row for the active cycle (not carry-forward).
      if (merged.monthlyIncomeCents > 0) {
        await runWithIncomeWrite("onboarding", async () => {
          const cycles = await ensureCyclesUpToToday({ userId: user.id, incomeCycle });
          setBudgetCycles(cycles);
          const cycle =
            findCycleForMonthKey(cycles, currentMonth) ??
            cycles.find((c) => c.status === "active") ??
            null;
          if (!cycle) {
            throw new Error("Could not resolve a budget cycle for onboarding income");
          }
          const { error } = await supabase.from("income_entries").insert({
            user_id: user.id,
            cycle_id: cycle.id,
            amount_cents: merged.monthlyIncomeCents,
            received_date: cycle.startDate,
            source: "onboarding",
            note: "Income from setup",
            date_is_estimated: false,
          });
          if (error) throw new Error(error.message);
          await cycleIncome.invalidateCycleQueries();
        });
      }

      // 2) Optional custom spending categories.
      if (hasSupabaseEnv) {
        for (const category of merged.categories) {
          const label = ONBOARDING_CATEGORY_TO_CUSTOM_LABEL[category];
          if (label) {
            const result = await addCustomCategory(label);
            if (!result.success && !result.error.toLowerCase().includes("already exists")) {
              throw new Error(result.error);
            }
          }
        }
      }

      // 3) Recurring bills — persist each fixed bill from onboarding.
      // Snapshot of any bills already in state, used only for de-duplication.
      const seedBills: RecurringBill[] = [...data.recurringBills];
      const newlyCreatedBills: RecurringBill[] = [];
      const { dueDay, nextDueDate } = defaultOnboardingRecurringSchedule(new Date(), currentMonth);

      for (const bill of merged.fixedBills) {
        const name = bill.name?.trim() ?? "";
        const amountCents = Math.max(0, bill.amountCents);
        if (!name || amountCents <= 0) continue;
        if (onboardingFixedBillAlreadyExists([...seedBills, ...newlyCreatedBills], name, amountCents)) {
          continue;
        }

        const created = await addRecurringBill({
          name,
          amountCents,
          category: "other",
          dueDay,
          frequency: "monthly",
          status: "upcoming",
          nextDueDate,
        });
        newlyCreatedBills.push(created);

        if (import.meta.env.DEV) {
          console.debug("[onboarding sync] saved recurring bill", {
            id: created.id,
            name: created.name,
            amountCents: created.amountCents,
            nextDueDate: created.nextDueDate,
            userId: created.userId,
          });
        }
      }

      if (import.meta.env.DEV) {
        console.debug(
          "[onboarding sync] recurring bills created in this run",
          newlyCreatedBills.length,
        );
      }

      // 4) Monthly savings goal — look up any existing plan goal directly from
      // Supabase (or local state when offline) so we don't rely on a stale React
      // closure that may have been captured before loadFromSupabase ran.
      const horizonMonths = 12;
      let planGoal: SavingsGoal | undefined;

      if (hasSupabaseEnv) {
        const { data: existingGoalRow, error: existingGoalError } = await supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .eq("name", ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME)
          .maybeSingle();

        if (existingGoalError && import.meta.env.DEV) {
          console.debug("[onboarding sync] existing goal lookup error", existingGoalError.message);
        }

        if (existingGoalRow) {
          const row = existingGoalRow as GoalRow;
          planGoal = {
            id: row.id,
            name: row.name,
            targetCents: row.target_cents,
            savedCents: row.saved_cents,
            startDate: row.start_date,
            targetDate: row.target_date,
            createdAt: row.created_at,
          };
        }
      } else {
        planGoal = data.savingsGoals.find((g) => g.name === ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME);
      }

      let createdOrUpdatedGoal: SavingsGoal | null = null;
      if (merged.monthlySavingsGoalCents > 0) {
        const targetCents = merged.monthlySavingsGoalCents * horizonMonths;
        const startDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
        const targetDate = format(addMonths(startOfMonth(new Date()), horizonMonths), "yyyy-MM-dd");

        if (planGoal) {
          await updateSavingsGoal(planGoal.id, {
            targetCents,
            startDate,
            targetDate,
          });
          createdOrUpdatedGoal = { ...planGoal, targetCents, startDate, targetDate };
        } else {
          const createdGoal = await addSavingsGoal({
            name: ONBOARDING_MONTHLY_SAVINGS_GOAL_NAME,
            targetCents,
            savedCents: 0,
            startDate,
            targetDate,
          });
          createdOrUpdatedGoal = createdGoal;
          if (import.meta.env.DEV) {
            console.debug("[onboarding sync] created savings goal", {
              id: createdGoal.id,
              targetCents: createdGoal.targetCents,
            });
          }
        }
      } else if (planGoal) {
        await deleteSavingsGoal(planGoal.id);
      }

      // 5) Final reconciliation — pull the freshest snapshot from Supabase (or
      // local cache when offline) so the dashboard renders bills + goals + budget
      // in one consistent state, no refresh needed.
      if (!hasSupabaseEnv) {
        const fromDisk = readRecurringBillsFromLocal(user.id);
        setData((prev) => {
          const ids = new Set(fromDisk.map((b) => b.id));
          const extras = newlyCreatedBills.filter((b) => !ids.has(b.id));
          const goals = createdOrUpdatedGoal
            ? prev.savingsGoals.some((g) => g.id === createdOrUpdatedGoal!.id)
              ? prev.savingsGoals.map((g) =>
                  g.id === createdOrUpdatedGoal!.id ? createdOrUpdatedGoal! : g,
                )
              : [...prev.savingsGoals, createdOrUpdatedGoal]
            : prev.savingsGoals;
          return {
            ...prev,
            recurringBills: [...fromDisk, ...extras],
            savingsGoals: goals,
          };
        });
        if (import.meta.env.DEV) {
          console.debug(
            "[onboarding sync] reconciled recurring bills from local storage",
            fromDisk.length,
          );
        }
      } else {
        await loadFromSupabase(user.id, { showLoading: false });
        // After the refresh, defensively make sure any bills/goals we just
        // created are still in state in case of read-after-write lag or a
        // transient error during the reload.
        setData((prev) => {
          const billIds = new Set(prev.recurringBills.map((b) => b.id));
          const billExtras = newlyCreatedBills.filter((b) => !billIds.has(b.id));
          const nextBills = billExtras.length > 0
            ? [...prev.recurringBills, ...billExtras]
            : prev.recurringBills;
          if (billExtras.length > 0 && user) {
            writeRecurringBillsToLocal(user.id, nextBills);
          }

          const nextGoals = createdOrUpdatedGoal
            ? prev.savingsGoals.some((g) => g.id === createdOrUpdatedGoal!.id)
              ? prev.savingsGoals.map((g) =>
                  g.id === createdOrUpdatedGoal!.id ? createdOrUpdatedGoal! : g,
                )
              : [...prev.savingsGoals, createdOrUpdatedGoal]
            : prev.savingsGoals;

          if (nextBills === prev.recurringBills && nextGoals === prev.savingsGoals) {
            return prev;
          }
          return { ...prev, recurringBills: nextBills, savingsGoals: nextGoals };
        });
        if (import.meta.env.DEV) {
          console.debug("[onboarding sync] full finance reload after onboarding complete");
        }
      }
    },
    [
      isDemoMode,
      user,
      addCustomCategory,
      addRecurringBill,
      addSavingsGoal,
      currentMonth,
      cycleIncome,
      data.recurringBills,
      data.savingsGoals,
      deleteSavingsGoal,
      incomeCycle,
      loadFromSupabase,
      updateSavingsGoal,
    ],
  );

  const addContributionToGoal = useCallback(
    (goalId: string, amountCents: number) => {
      if (isDemoMode) {
        toast.info("Sample budget", { description: DEMO_EDIT_MESSAGE });
        return;
      }
      if (!user || amountCents <= 0) return;
      setData((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) =>
          g.id === goalId ? { ...g, savedCents: g.savedCents + amountCents } : g,
        ),
      }));
      void supabase.rpc("increment_goal_saved_cents", {
        p_goal_id: goalId,
        p_user_id: user.id,
        p_amount_cents: amountCents,
      });
      void supabase.from("goal_contributions").insert({
        user_id: user.id,
        goal_id: goalId,
        amount_cents: amountCents,
      });
    },
    [isDemoMode, user],
  );

  const reverseContributionFromGoal = useCallback(
    async (goalId: string, amountCents: number) => {
      if (isDemoMode || !user || amountCents <= 0) return;

      setData((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) =>
          g.id === goalId
            ? { ...g, savedCents: Math.max(0, g.savedCents - amountCents) }
            : g,
        ),
      }));

      const { error: rpcError } = await supabase.rpc("increment_goal_saved_cents", {
        p_goal_id: goalId,
        p_user_id: user.id,
        p_amount_cents: -amountCents,
      });

      if (rpcError) {
        throw rpcError;
      }

      const { error: insertError } = await supabase.from("goal_contributions").insert({
        user_id: user.id,
        goal_id: goalId,
        amount_cents: -amountCents,
      });

      if (insertError) {
        throw insertError;
      }
    },
    [isDemoMode, user],
  );

  const cycleExpenses = useMemo(() => {
    if (selectedCycle) {
      return data.expenses.filter((exp) => isDateInBudgetCycle(exp.date, selectedCycle));
    }
    return currentMonthData.expenses;
  }, [currentMonthData.expenses, data.expenses, selectedCycle]);

  return {
    isLoading,
    currentMonth,
    setCurrentMonth,
    getMonthData,
    budget: effectiveBudget,
    expenses: cycleExpenses,
    allExpenses: data.expenses,
    totalSpentCents,
    totalIncomeThisCycleCents,
    hasIncomeForCycle,
    previousCycleIncomeCents,
    selectedCycle,
    previousCycle,
    budgetCycles,
    remainingIncomeCents,
    safeToSpendCents,
    savingsGoalAllocationCents,
    upcomingBills,
    upcomingUnpaidBillsCents,
    upcomingBillsBeforeNextSalary,
    nextSalaryDate,
    incomeCycle,
    isIncomeCycleConfigured: incomeCycleConfigured,
    saveIncomeCycle,
    financeDiagnostics,
    settingsHydrated,
    recurringBills: data.recurringBills,
    remainingCents,
    hasAnyData,
    setSalary,
    setCurrency,
    updateMonthlyIncome,
    getCurrentMonthIncome,
    getPreviousMonthIncome,
    getIncomeDifference,
    addExpense,
    updateExpense,
    deleteExpense,
    allCategories,
    customCategories: data.customCategories,
    addCustomCategory,
    removeCustomCategory,
    deleteCategory,
    categoryLimitsForMonth,
    setCategoryLimit,
    savingsGoals: data.savingsGoals,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    addContributionToGoal,
    reverseContributionFromGoal,
    addRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    markRecurringBillPaid,
    syncFromOnboarding,
  };
}

export type FinanceDataContextValue = ReturnType<typeof useFinanceDataInternal>;

const FinanceDataContext = createContext<FinanceDataContextValue | null>(null);

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const value = useFinanceDataInternal();
  return createElement(FinanceDataContext.Provider, { value }, children);
}

export function useSupabaseFinanceData(): FinanceDataContextValue {
  const ctx = useContext(FinanceDataContext);
  if (!ctx) {
    throw new Error("useSupabaseFinanceData must be used within FinanceDataProvider");
  }
  return ctx;
}
