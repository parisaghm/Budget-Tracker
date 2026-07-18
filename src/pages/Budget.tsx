import { useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useDemo } from "@/context/DemoContext";
import { AppShellHeader, appShellMaxWidthClass } from "@/components/AppShellHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { SalarySetup, type SalarySetupHandle } from "@/components/SalarySetup";
import { BudgetAllocationStrip } from "@/components/budget/BudgetAllocationStrip";
import { CategoryBudgetList } from "@/components/budget/CategoryBudgetList";
import { buildBudgetPlanningSummary } from "@/utils/budgetPlanning";
import { cn } from "@/lib/utils";

export default function BudgetPage() {
  const { isDemoMode } = useDemo();
  const salarySetupRef = useRef<SalarySetupHandle>(null);
  const [showSalaryEditor, setShowSalaryEditor] = useState(false);

  const {
    currentMonth,
    setCurrentMonth,
    budget,
    expenses,
    setSalary,
    addExpense,
    allCategories,
    categoryLimitsForMonth,
    setCategoryLimit,
    deleteCategory,
    incomeCycle,
    totalIncomeThisCycleCents,
    hasIncomeForCycle,
    previousCycleIncomeCents,
  } = useSupabaseFinanceData();

  const activeCurrency = budget?.currency ?? "EUR";
  const incomeCents = totalIncomeThisCycleCents;

  const planning = useMemo(
    () =>
      buildBudgetPlanningSummary({
        categories: allCategories,
        expenses,
        categoryLimits: categoryLimitsForMonth,
        incomeCents,
      }),
    [allCategories, categoryLimitsForMonth, expenses, incomeCents],
  );

  return (
    <>
      <Helmet>
        <title>Budget · Sova Budget</title>
        <meta
          name="description"
          content="Plan and allocate your monthly budget — assign income to category limits."
        />
      </Helmet>
      <div className="budget-page flex min-h-dvh flex-col bg-background">
        <AppShellHeader
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          incomeCycle={incomeCycle}
          currency={activeCurrency}
          contentMaxWidth={appShellMaxWidthClass}
          subtitle="PLAN & ALLOCATE"
          mobileLayout="budget"
        />
        <main
          className={`container ${appShellMaxWidthClass} flex-1 space-y-3 px-5 pb-mobile-nav pr-mobile-fab pt-4 sm:space-y-4 sm:px-7 sm:pt-5 md:pb-10 md:pr-4 lg:px-9 lg:pt-6`}
        >
          {!isDemoMode ? (
            <div
              className={cn(
                "card-elevated p-4",
                hasIncomeForCycle && !showSalaryEditor && "hidden",
              )}
            >
              <p className="label-caps mb-3">Income this cycle</p>
              <SalarySetup
                ref={salarySetupRef}
                embedded
                currentSalaryCents={hasIncomeForCycle ? totalIncomeThisCycleCents : null}
                previousCycleIncomeCents={previousCycleIncomeCents}
                incomeNote={budget?.incomeNote ?? null}
                currency={activeCurrency}
                onSave={(cents, note) => {
                  void setSalary(cents, note);
                  setShowSalaryEditor(false);
                }}
              />
            </div>
          ) : null}

          <div className="budget-page-grid">
            <div className="budget-page-section budget-page-section--allocation">
              <BudgetAllocationStrip
                currency={activeCurrency}
                incomeCents={planning.incomeCents}
                assignedCents={planning.assignedCents}
                unassignedCents={planning.unassignedCents}
                assignmentProgressPct={planning.assignmentProgressPct}
                isOverAssigned={planning.isOverAssigned}
                onAdjustIncome={
                  !isDemoMode
                    ? () => {
                        setShowSalaryEditor(true);
                        requestAnimationFrame(() => salarySetupRef.current?.openEdit());
                      }
                    : undefined
                }
              />
            </div>

            <div className="budget-page-section budget-page-section--list">
              <CategoryBudgetList
                snapshots={planning.categorySnapshots}
                currency={activeCurrency}
                onSetCategoryLimit={!isDemoMode ? setCategoryLimit : undefined}
                onDeleteCategory={!isDemoMode ? deleteCategory : undefined}
              />
            </div>
          </div>
        </main>
        <QuickAddExpenseSheet
          currency={activeCurrency}
          categories={allCategories}
          budgetMonth={currentMonth}
          onAdd={addExpense}
        />
        <MobileBottomNav />
      </div>
    </>
  );
}
