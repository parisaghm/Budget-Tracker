import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, FileText, LogOut, ReceiptText, Settings, UserCircle, Wallet } from 'lucide-react';
import { useSupabaseFinanceData } from '@/hooks/useSupabaseFinanceData';
import { useAuth } from '@/context/AuthContext';
import { useDemo } from '@/context/DemoContext';
import { hasSupabaseEnv, supabase, supabaseEnvError } from '@/lib/supabase/client';
import { MonthSelector } from '@/components/MonthSelector';
import { SalarySetup, type SalarySetupHandle } from '@/components/SalarySetup';
import { BudgetSummary } from '@/components/BudgetSummary';
import { SavingsGoals } from '@/components/SavingsGoals';
import { ExpenseForm } from '@/components/ExpenseForm';
import { ExpenseList } from '@/components/ExpenseList';
import { CategoryChart } from '@/components/CategoryChart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CurrencySelector } from '@/components/CurrencySelector';
import { Switch } from '@/components/ui/switch';
import { UpcomingBillsCard } from '@/components/UpcomingBillsCard';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { QuickAddExpenseSheet } from '@/components/QuickAddExpenseSheet';
import { InstallAppButton } from '@/components/InstallAppButton';
import type { Category } from '@/types/finance';
import { formatMoney } from '@/utils/money';

const NOTIFICATION_SETTINGS_KEY = 'bt_notification_preferences_v1';
const NOTIFICATION_LOG_KEY = 'bt_notification_log_v1';

function useLgUp(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return matches;
}

function displayNameFromUser(user: User | null | undefined): string {
  if (!user) return '';
  const m = user.user_metadata ?? {};
  const candidates = [
    m.full_name,
    m.name,
    m.display_name,
    m.preferred_username,
    m.given_name && m.family_name ? `${m.given_name} ${m.family_name}` : null,
    m.given_name,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  const email = user.email;
  if (email?.includes('@')) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }
  return email ?? '';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isDemoMode, exitDemo } = useDemo();
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [compareWithPreviousMonth, setCompareWithPreviousMonth] = useState(false);
  const salarySetupRef = useRef<SalarySetupHandle>(null);
  const {
    currentMonth,
    setCurrentMonth,
    getMonthData,
    budget,
    expenses,
    totalSpentCents,
    remainingCents,
    setSalary,
    setCurrency,
    addExpense,
    updateExpense,
    deleteExpense,
    allCategories,
    addCustomCategory,
    deleteCategory,
    categoryLimitsForMonth,
    setCategoryLimit,
    savingsGoals,
    addSavingsGoal,
    addContributionToGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    recurringBills,
    upcomingBills,
    upcomingBillsBeforeNextSalary,
    upcomingUnpaidBillsCents,
    getCurrentMonthIncome,
    getPreviousMonthIncome,
    getIncomeDifference,
    isLoading,
  } = useSupabaseFinanceData();

  const isLgUp = useLgUp();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug(
      "[dashboard] recurring bills loaded for dashboard",
      recurringBills.length,
      recurringBills.map((b) => ({
        name: b.name,
        amountCents: b.amountCents,
        nextDueDate: b.nextDueDate,
        status: b.status,
      })),
    );
  }, [recurringBills]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.debug("[dashboard] upcomingBills computed", {
      total: upcomingBills.length,
      beforeNextSalary: upcomingBillsBeforeNextSalary.length,
      upcomingUnpaidBillsCents,
      savingsGoals: savingsGoals.length,
    });
  }, [upcomingBills, upcomingBillsBeforeNextSalary, upcomingUnpaidBillsCents, savingsGoals]);

  const displayName = useMemo(() => displayNameFromUser(user), [user]);

  const previousMonthKey = useMemo(() => {
    const [yearPart, monthPart] = currentMonth.split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return currentMonth;
    }
    if (month === 1) return `${year - 1}-12`;
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  }, [currentMonth]);

  const previousMonthData = useMemo(() => getMonthData(previousMonthKey), [getMonthData, previousMonthKey]);

  const previousMonthTotalSpentCents = useMemo(
    () => previousMonthData.expenses.reduce((sum, exp) => sum + exp.amountCents, 0),
    [previousMonthData.expenses],
  );

  const sumByCategory = (list: typeof expenses) => {
    const map: Record<string, number> = {};
    list.forEach((exp) => {
      map[exp.category] = (map[exp.category] || 0) + exp.amountCents;
    });
    return map;
  };

  const currentByCategory = useMemo(() => sumByCategory(expenses), [expenses]);
  const previousMonthByCategory = useMemo(
    () => sumByCategory(previousMonthData.expenses),
    [previousMonthData.expenses],
  );

  const describeChange = (current: number, base: number): string => {
    if (base === 0 && current === 0) return 'unchanged';
    if (base === 0 && current > 0) return 'new vs previous month';
    if (base === current) return 'unchanged';
    const pct = Math.round(((current - base) / base) * 100);
    if (pct > 0) return `↑ ${pct}%`;
    if (pct < 0) return `↓ ${Math.abs(pct)}%`;
    return 'unchanged';
  };

  const spendingChange = describeChange(totalSpentCents, previousMonthTotalSpentCents);

  const groceriesCategory = allCategories.find(
    (c) => c.value === 'groceries' || c.label.toLowerCase() === 'groceries',
  );
  const rentCategory = allCategories.find(
    (c) => c.value === 'rent' || c.label.toLowerCase().includes('rent'),
  );

  const groceriesChange =
    groceriesCategory &&
    describeChange(
      currentByCategory[groceriesCategory.value] || 0,
      previousMonthByCategory[groceriesCategory.value] || 0,
    );

  const rentChange =
    rentCategory &&
    describeChange(
      currentByCategory[rentCategory.value] || 0,
      previousMonthByCategory[rentCategory.value] || 0,
    );

  const activeCurrency = budget?.currency ?? 'EUR';
  const hasAnyRecurringBills = recurringBills.length > 0;

  const currentIncome = getCurrentMonthIncome();
  const previousIncome = getPreviousMonthIncome();
  const incomeDiff = getIncomeDifference();

  const headerLinks = [
    { to: `/report/${currentMonth}`, label: 'Report', icon: FileText },
    { to: '/bills', label: 'Bills', icon: ReceiptText },
    { to: '/weekly-review', label: 'Review', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  const onLogout = async () => {
    if (isDemoMode) {
      exitDemo();
      return;
    }
    if (!hasSupabaseEnv) return;
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let prefs: { weeklyReview?: boolean; upcomingBills?: boolean; goalProgress?: boolean } = {};
    try {
      const prefsRaw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (!prefsRaw) return;
      prefs = JSON.parse(prefsRaw);
    } catch {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    let log: Record<string, string> = {};
    try {
      log = JSON.parse(localStorage.getItem(NOTIFICATION_LOG_KEY) ?? '{}') as Record<string, string>;
    } catch {
      log = {};
    }

    const maybeNotify = (key: string, title: string, body: string) => {
      if (log[key] === today) return;
      new Notification(title, { body, tag: key, silent: true });
      log[key] = today;
    };

    if (prefs.weeklyReview) {
      maybeNotify('weekly-review', 'Weekly review check-in', 'Take 2 minutes to review this week and stay calm.');
    }
    if (prefs.upcomingBills && upcomingBills.length > 0) {
      maybeNotify(
        'upcoming-bills',
        'Upcoming bill reminder',
        `${upcomingBills[0].name} is due soon. Keep your safe-to-spend in view.`,
      );
    }
    if (prefs.goalProgress && savingsGoals.length > 0) {
      maybeNotify('goal-progress', 'Goal progress reminder', 'A small contribution this week keeps your goal on track.');
    }

    localStorage.setItem(NOTIFICATION_LOG_KEY, JSON.stringify(log));
  }, [savingsGoals.length, upcomingBills]);

  const dashboardLeftRailExtras = (
    <div className="space-y-5 sm:space-y-6">
      {budget || recurringBills.length > 0 ? (
        <>
          <div className="card-elevated p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Weekly review
              </p>
              <Link
                to="/weekly-review"
                className="touch-hit min-h-10 rounded-lg px-2 text-sm font-semibold text-primary"
              >
                Open
              </Link>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              A short check-in: spending rhythm, bills, and goals.
            </p>
            <Link
              to="/weekly-review"
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground sm:w-auto"
            >
              Start review
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <UpcomingBillsCard
            bills={upcomingBills}
            totalDueBeforeSalaryCents={upcomingUnpaidBillsCents}
            hasAnyRecurringBills={hasAnyRecurringBills}
            currency={activeCurrency}
          />
          <div className="card-elevated mt-3 hidden space-y-3 p-4 md:block">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Income history
                </p>
                <p className="text-sm text-foreground">Current vs previous month</p>
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">Current month income</span>
                <span className="money-display font-medium">
                  {formatMoney(currentIncome.salaryCents, activeCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">Previous month income</span>
                <span className="money-display font-medium">
                  {formatMoney(previousIncome.salaryCents, activeCurrency)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">Difference</span>
                <span
                  className={`money-display font-medium ${
                    incomeDiff.differenceCents > 0
                      ? 'text-emerald-500'
                      : incomeDiff.differenceCents < 0
                        ? 'text-destructive'
                        : ''
                  }`}
                >
                  {formatMoney(incomeDiff.differenceCents, activeCurrency)}
                </span>
              </div>
              {(currentIncome.incomeNote || previousIncome.incomeNote) && (
                <div className="space-y-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {currentIncome.incomeNote && (
                    <p>
                      <span className="font-semibold">This month:</span> {currentIncome.incomeNote}
                    </p>
                  )}
                  {previousIncome.incomeNote && (
                    <p>
                      <span className="font-semibold">Previous month:</span> {previousIncome.incomeNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="card-elevated mt-3 hidden space-y-3 p-4 md:block">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Monthly comparison
                </p>
                <p className="text-sm text-foreground">Simple snapshot vs previous month</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">Compare prior month</span>
                <Switch
                  checked={compareWithPreviousMonth}
                  onCheckedChange={(val) => setCompareWithPreviousMonth(Boolean(val))}
                />
              </div>
            </div>
            {compareWithPreviousMonth &&
              (previousMonthData.expenses.length > 0 ? (
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                    <span className="text-muted-foreground">Spending</span>
                    <span className="font-medium text-foreground">{spendingChange}</span>
                  </div>
                  {groceriesChange && (
                    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                      <span className="text-muted-foreground">Groceries</span>
                      <span className="font-medium text-foreground">{groceriesChange}</span>
                    </div>
                  )}
                  {rentChange && (
                    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                      <span className="text-muted-foreground">Rent</span>
                      <span className="font-medium text-foreground">{rentChange}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Not enough previous month data yet to compare.
                </p>
              ))}
          </div>
        </>
      ) : null}
      <SavingsGoals
        goals={savingsGoals}
        remainingCents={remainingCents}
        currency={activeCurrency}
        onAddGoal={addSavingsGoal}
        onAddContribution={addContributionToGoal}
        onUpdateGoal={updateSavingsGoal}
        onDeleteGoal={deleteSavingsGoal}
      />
      <CategoryChart
        expenses={expenses}
        categories={allCategories}
        currency={activeCurrency}
        selectedCategory={categoryFilter === 'all' ? null : categoryFilter}
        onCategorySelect={(cat) => setCategoryFilter(cat ?? 'all')}
        categoryLimits={categoryLimitsForMonth}
        onSetCategoryLimit={setCategoryLimit}
      />
    </div>
  );

  const budgetSummarySection =
    isDemoMode && !budget ? null : (
      <BudgetSummary
        salaryCents={budget?.salaryCents ?? 0}
        totalSpentCents={totalSpentCents}
        remainingCents={remainingCents}
        currency={activeCurrency}
        onEditSalary={isDemoMode ? undefined : () => salarySetupRef.current?.openEdit()}
        salaryControls={
          !isDemoMode ? (
            <SalarySetup
              ref={salarySetupRef}
              embedded
              currentSalaryCents={budget?.salaryCents || null}
              incomeNote={budget?.incomeNote ?? null}
              currency={activeCurrency}
              onSave={setSalary}
            />
          ) : undefined
        }
      />
    );

  const expenseFormSection = (
    <ExpenseForm
      currency={activeCurrency}
      onAdd={addExpense}
      categories={allCategories}
      expenses={expenses}
      onAddCategory={addCustomCategory}
      onDeleteCategory={deleteCategory}
    />
  );

  const expenseListSection = (
    <ExpenseList
      expenses={expenses}
      categories={allCategories}
      currency={activeCurrency}
      monthScope={currentMonth}
      categoryFilter={categoryFilter}
      onCategoryFilterChange={setCategoryFilter}
      onUpdate={updateExpense}
      onDelete={deleteExpense}
    />
  );

  return (
    <>
      <Helmet>
        <title>Budget Tracker - Manage Your Monthly Finances</title>
        <meta name="description" content="Track your monthly expenses, manage your budget, and stay on top of your finances with our simple budget tracking app." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
          <div className="container max-w-6xl px-4 py-2.5 sm:px-6 sm:py-4 lg:px-8">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm shadow-black/5 sm:rounded-[1.75rem] sm:p-3 sm:shadow-md">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md shadow-primary/15 sm:h-12 sm:w-12 sm:shadow-lg sm:shadow-primary/20"
                    style={{ background: 'var(--gradient-primary)' }}
                  >
                    <Wallet className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-bold leading-tight text-foreground sm:text-2xl">
                        Budget Tracker
                      </h1>
                      {hasSupabaseEnv && !isDemoMode ? (
                        <CurrencySelector
                          variant="header"
                          value={activeCurrency}
                          onChange={setCurrency}
                        />
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                          {activeCurrency}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 hidden text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground sm:block">
                      Monthly finances
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                  <div className="hidden min-w-0 items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 sm:flex">
                    <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {isDemoMode ? 'Demo preview' : 'Signed in'}
                      </p>
                      <p className="max-w-[12rem] truncate text-xs font-semibold text-foreground">
                        {isDemoMode ? 'Sample household' : displayName || 'Account'}
                      </p>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="hidden sm:block">
                      <InstallAppButton />
                    </div>
                    <ThemeToggle />
                    <MonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
                  </div>
                </div>
              </div>

              <div className="mt-3 hidden flex-wrap items-center gap-2 border-t border-border/60 pt-3 md:flex">
                {headerLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-secondary/70 px-3 py-2.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary sm:flex-none sm:px-4"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex-none sm:px-4"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  {isDemoMode ? 'Leave demo' : 'Logout'}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/50 pt-2 md:hidden">
                <button
                  type="button"
                  onClick={onLogout}
                  className="touch-hit inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {isDemoMode ? 'Leave demo' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="container max-w-6xl px-4 pb-mobile-nav pt-5 sm:px-6 sm:pt-8 md:pb-10 lg:px-8">
          {isLoading ? (
            <div className="card-elevated p-6">
              <p className="text-sm text-muted-foreground">Loading your budget data...</p>
            </div>
          ) : null}
          {!hasSupabaseEnv && !isDemoMode ? (
            <div className="card-elevated p-6">
              <p className="text-sm text-destructive">{supabaseEnvError}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Create a `.env` file from `.env.example` and restart `npm run dev`.
              </p>
            </div>
          ) : null}
          {isLgUp ? (
            <div className="flex flex-row items-start gap-x-6 sm:gap-x-8">
              <div className="flex min-w-0 flex-1 flex-col gap-5 sm:gap-6">
                {budgetSummarySection}
                {dashboardLeftRailExtras}
              </div>
              <div className="flex min-w-0 flex-[1.1] flex-col gap-5 sm:gap-6">
                {expenseFormSection}
                {expenseListSection}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5 sm:gap-6">
              {budgetSummarySection}
              {expenseFormSection}
              {dashboardLeftRailExtras}
              {expenseListSection}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-8 hidden border-t border-border sm:mt-14 md:block">
          <div className="container max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <p className="text-center text-sm text-muted-foreground">
              Your data is private and protected by authentication and RLS · Built with ❤️
            </p>
          </div>
        </footer>
        <QuickAddExpenseSheet
          currency={activeCurrency}
          categories={allCategories}
          onAdd={addExpense}
        />
        <MobileBottomNav />
      </div>
    </>
  );
}
