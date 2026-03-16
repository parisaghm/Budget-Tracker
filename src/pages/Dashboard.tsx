import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useFinanceData } from '@/hooks/useFinanceData';
import { MonthSelector } from '@/components/MonthSelector';
import { SalarySetup } from '@/components/SalarySetup';
import { BudgetSummary } from '@/components/BudgetSummary';
import { SavingsGoals } from '@/components/SavingsGoals';
import { ExpenseForm } from '@/components/ExpenseForm';
import { ExpenseList } from '@/components/ExpenseList';
import { CategoryChart } from '@/components/CategoryChart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Switch } from '@/components/ui/switch';
import type { Category } from '@/types/finance';
import { formatMoney } from '@/utils/money';

export default function Dashboard() {
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [compareWithJanuary, setCompareWithJanuary] = useState(false);
  const {
    currentMonth,
    setCurrentMonth,
    getMonthData,
    budget,
    expenses,
    totalSpentCents,
    remainingCents,
    setSalary,
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
    getCurrentMonthIncome,
    getPreviousMonthIncome,
    getIncomeDifference,
  } = useFinanceData();

  const januaryMonthKey = useMemo(() => {
    const year = currentMonth.slice(0, 4);
    return `${year}-01`;
  }, [currentMonth]);

  const januaryData = useMemo(() => getMonthData(januaryMonthKey), [getMonthData, januaryMonthKey]);

  const januaryTotalSpentCents = useMemo(
    () => januaryData.expenses.reduce((sum, exp) => sum + exp.amountCents, 0),
    [januaryData.expenses],
  );

  const sumByCategory = (list: typeof expenses) => {
    const map: Record<string, number> = {};
    list.forEach((exp) => {
      map[exp.category] = (map[exp.category] || 0) + exp.amountCents;
    });
    return map;
  };

  const currentByCategory = useMemo(() => sumByCategory(expenses), [expenses]);
  const januaryByCategory = useMemo(() => sumByCategory(januaryData.expenses), [januaryData.expenses]);

  const describeChange = (current: number, base: number): string => {
    if (base === 0 && current === 0) return 'unchanged';
    if (base === 0 && current > 0) return 'new vs January';
    if (base === current) return 'unchanged';
    const pct = Math.round(((current - base) / base) * 100);
    if (pct > 0) return `↑ ${pct}%`;
    if (pct < 0) return `↓ ${Math.abs(pct)}%`;
    return 'unchanged';
  };

  const spendingChange = describeChange(totalSpentCents, januaryTotalSpentCents);

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
      januaryByCategory[groceriesCategory.value] || 0,
    );

  const rentChange =
    rentCategory &&
    describeChange(currentByCategory[rentCategory.value] || 0, januaryByCategory[rentCategory.value] || 0);

  const activeCurrency = budget?.currency ?? 'EUR';

  const currentIncome = getCurrentMonthIncome();
  const previousIncome = getPreviousMonthIncome();
  const incomeDiff = getIncomeDifference();

  return (
    <>
      <Helmet>
        <title>Budget Tracker - Manage Your Monthly Finances</title>
        <meta name="description" content="Track your monthly expenses, manage your budget, and stay on top of your finances with our simple budget tracking app." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="container max-w-6xl px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Wallet className="h-5 w-5 text-black" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Budget Tracker</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-muted-foreground tracking-wide uppercase">
                      Monthly finances
                    </p>
                    <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tracking-wide">
                      {activeCurrency}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <ThemeToggle />
                <MonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
                <Link
                  to={`/report/${currentMonth}`}
                  className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-colors"
                >
                  Open report
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="container max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Left column */}
            <div className="space-y-5 sm:space-y-6">
              <SalarySetup
                currentSalaryCents={budget?.salaryCents || null}
                incomeNote={budget?.incomeNote ?? null}
                onSave={setSalary}
              />
              {budget && (
                <>
                  <BudgetSummary
                    salaryCents={budget.salaryCents}
                    totalSpentCents={totalSpentCents}
                    remainingCents={remainingCents}
                  />
                  <div className="mt-3 card-elevated p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
                          Income history
                        </p>
                        <p className="text-sm text-foreground">
                          Current vs previous month
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                        <span className="text-muted-foreground">Current month income</span>
                        <span className="font-medium money-display">
                          {formatMoney(currentIncome.salaryCents, activeCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                        <span className="text-muted-foreground">Previous month income</span>
                        <span className="font-medium money-display">
                          {formatMoney(previousIncome.salaryCents, activeCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                        <span className="text-muted-foreground">Difference</span>
                        <span className={`font-medium money-display ${
                          incomeDiff.differenceCents > 0
                            ? 'text-emerald-500'
                            : incomeDiff.differenceCents < 0
                              ? 'text-destructive'
                              : ''
                        }`}>
                          {formatMoney(incomeDiff.differenceCents, activeCurrency)}
                        </span>
                      </div>
                      {(currentIncome.incomeNote || previousIncome.incomeNote) && (
                        <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1">
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
                  <div className="mt-3 card-elevated p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
                          Monthly comparison
                        </p>
                        <p className="text-sm text-foreground">
                          Simple snapshot vs January
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          📅 Compare with January
                        </span>
                        <Switch
                          checked={compareWithJanuary}
                          onCheckedChange={(val) => setCompareWithJanuary(Boolean(val))}
                        />
                      </div>
                    </div>
                    {compareWithJanuary && (
                      januaryData.expenses.length > 0 ? (
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                            <span className="text-muted-foreground">Spending</span>
                            <span className="font-medium text-foreground">
                              {spendingChange}
                            </span>
                          </div>
                          {groceriesChange && (
                            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                              <span className="text-muted-foreground">Groceries</span>
                              <span className="font-medium text-foreground">
                                {groceriesChange}
                              </span>
                            </div>
                          )}
                          {rentChange && (
                            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                              <span className="text-muted-foreground">Rent</span>
                              <span className="font-medium text-foreground">
                                {rentChange}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Not enough January data yet to compare.
                        </p>
                      )
                    )}
                  </div>
                </>
              )}
              <SavingsGoals
                goals={savingsGoals}
                remainingCents={remainingCents}
                onAddGoal={addSavingsGoal}
                onAddContribution={addContributionToGoal}
                onUpdateGoal={updateSavingsGoal}
                onDeleteGoal={deleteSavingsGoal}
              />
              <CategoryChart
                expenses={expenses}
                categories={allCategories}
                selectedCategory={categoryFilter === 'all' ? null : categoryFilter}
                onCategorySelect={(cat) => setCategoryFilter(cat ?? 'all')}
                categoryLimits={categoryLimitsForMonth}
                onSetCategoryLimit={setCategoryLimit}
              />
            </div>

            {/* Right column */}
            <div className="space-y-5 sm:space-y-6">
              <ExpenseForm onAdd={addExpense} categories={allCategories} onAddCategory={addCustomCategory} onDeleteCategory={deleteCategory} />
              <ExpenseList
                expenses={expenses}
                categories={allCategories}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                onUpdate={updateExpense}
                onDelete={deleteExpense}
              />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-10 sm:mt-14">
          <div className="container max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <p className="text-center text-sm text-muted-foreground">
              Your data is stored locally in your browser · Built with ❤️
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
