import { useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { useDemo } from "@/context/DemoContext";
import { AppShellHeader, appShellMaxWidthClass } from "@/components/AppShellHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { SalarySetup, type SalarySetupHandle } from "@/components/SalarySetup";
import { BudgetSectionHeader } from "@/components/budget/BudgetSectionHeader";
import { BudgetGroupCard } from "@/components/budget/BudgetGroupCard";
import { BudgetTotalRow } from "@/components/budget/BudgetTotalRow";
import { BudgetHelperRow } from "@/components/budget/BudgetHelperRow";
import { BudgetSidebarLeftToBudgetCard } from "@/components/budget/BudgetSidebarLeftToBudgetCard";
import { BudgetSidebarSummaryTabs } from "@/components/budget/BudgetSidebarSummaryTabs";
import { AllocateCycleSavingsDialog } from "@/components/savings/AllocateCycleSavingsDialog";
import { buildBudgetPageModel } from "@/utils/budgetPageModel";
import { formatMoney } from "@/utils/money";

export default function BudgetPage() {
  const { isDemoMode } = useDemo();
  const salarySetupRef = useRef<SalarySetupHandle>(null);
  const [showSalaryEditor, setShowSalaryEditor] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);

  const {
    currentMonth,
    setCurrentMonth,
    budget,
    expenses,
    setSalary,
    updateIncomeEntry,
    deleteIncomeEntry,
    addExpense,
    allCategories,
    categoryLimitsForMonth,
    setCategoryLimit,
    incomeCycle,
    totalIncomeThisCycleCents,
    hasIncomeForCycle,
    previousCycleIncomeCents,
    incomeEntries,
    selectedCycle,
    savingsGoalAllocationCents,
    upcomingBills,
    recurringBills,
    savingsGoals,
    contributionsByGoal,
    allocatedThisCycleCents,
    saveCycleAllocation,
    isSavingCycleAllocation,
  } = useSupabaseFinanceData();

  const activeCurrency = budget?.currency ?? "EUR";
  const showIncomePanel = !isDemoMode && (hasIncomeForCycle || showSalaryEditor);

  const model = useMemo(
    () =>
      buildBudgetPageModel({
        categories: allCategories,
        expenses,
        categoryLimits: categoryLimitsForMonth,
        incomeEntries: incomeEntries ?? [],
        totalIncomeCents: totalIncomeThisCycleCents,
        recurringBills,
        upcomingBills,
        selectedCycle,
        cycleStartIso: selectedCycle?.startDate ?? null,
        cycleEndIso: selectedCycle?.endDate ?? null,
        savingsGoals,
        contributionsByGoal,
        formatMoneyFn: (cents) => formatMoney(cents, activeCurrency),
      }),
    [
      activeCurrency,
      allCategories,
      categoryLimitsForMonth,
      contributionsByGoal,
      expenses,
      incomeEntries,
      recurringBills,
      savingsGoals,
      selectedCycle,
      totalIncomeThisCycleCents,
      upcomingBills,
    ],
  );

  const expenseRowCount =
    model.fixed.rows.length + model.flexible.rows.length + model.nonMonthly.rows.length;

  const openIncomeEditor = () => {
    setShowSalaryEditor(true);
    requestAnimationFrame(() => salarySetupRef.current?.openEdit());
  };

  const handleAssignMoney = () => {
    if (model.flexible.needsBudgetCount > 0) {
      document.getElementById("budget-section-expenses")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    if (model.contributions.plannedCents > model.contributions.actualCents) {
      setAllocateOpen(true);
      return;
    }
    document.getElementById("budget-section-expenses")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      <Helmet>
        <title>Budget · Sova Budget</title>
        <meta
          name="description"
          content="Plan your cycle budget — income, expenses, contributions, and left to budget."
        />
      </Helmet>
      <div className="budget-page flex min-h-dvh flex-col bg-background">
        <AppShellHeader
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          incomeCycle={incomeCycle}
          selectedCycle={selectedCycle}
          currency={activeCurrency}
          contentMaxWidth={appShellMaxWidthClass}
          subtitle="PLAN & ALLOCATE"
          mobileLayout="budget"
        />
        <main
          className={`container ${appShellMaxWidthClass} flex-1 space-y-3 px-5 pb-mobile-nav pr-mobile-fab pt-4 sm:space-y-4 sm:px-7 sm:pt-5 md:pb-10 md:pr-4 lg:px-9 lg:pt-6`}
        >
          <div className="budget-page-grid">
            <div className="budget-page-main">
              {/* Income */}
              <section className="budget-page-section" aria-label="Income">
                <BudgetSectionHeader title="Income" />
                <div className="budget-section-stack">
                  {showIncomePanel ? (
                    <div className="card-elevated p-4">
                      <SalarySetup
                        ref={salarySetupRef}
                        embedded
                        incomeEntries={incomeEntries ?? []}
                        previousCycleIncomeCents={previousCycleIncomeCents}
                        currency={activeCurrency}
                        onSave={async (cents, note) => {
                          await setSalary(cents, note);
                        }}
                        onUpdate={async (entryId, cents, note) => {
                          await updateIncomeEntry(entryId, cents, note);
                        }}
                        onDelete={async (entryId) => {
                          const wasLast = (incomeEntries?.length ?? 0) <= 1;
                          await deleteIncomeEntry(entryId);
                          if (wasLast) setShowSalaryEditor(true);
                        }}
                        onRequestClose={() => {
                          if (!hasIncomeForCycle) setShowSalaryEditor(false);
                        }}
                      />
                    </div>
                  ) : null}
                  <BudgetGroupCard
                    group={model.income}
                    currency={activeCurrency}
                    emptyMessage="No income recorded for this cycle yet."
                    footer={
                      !hasIncomeForCycle ? (
                        <BudgetHelperRow
                          message="Add income to start planning this cycle"
                          actionLabel="Add income"
                          onAction={!isDemoMode ? openIncomeEditor : undefined}
                        />
                      ) : undefined
                    }
                  />
                </div>
              </section>

              {/* Expenses */}
              <section
                id="budget-section-expenses"
                className="budget-page-section"
                aria-label="Expenses"
              >
                <BudgetSectionHeader title="Expenses" />
                <div className="budget-section-stack">
                  <BudgetGroupCard
                    group={model.fixed}
                    currency={activeCurrency}
                    emptyMessage="No fixed bills due in this cycle."
                    footer={
                      <BudgetHelperRow
                        message="Manage recurring bills"
                        actionLabel="Review"
                        actionTo="/bills"
                      />
                    }
                  />
                  <BudgetGroupCard
                    group={model.flexible}
                    currency={activeCurrency}
                    onSetCategoryLimit={!isDemoMode ? setCategoryLimit : undefined}
                    emptyMessage="No flexible category budgets yet."
                    footer={
                      model.flexible.needsBudgetCount > 0 ? (
                        <BudgetHelperRow
                          message={`${model.flexible.needsBudgetCount} categor${
                            model.flexible.needsBudgetCount === 1 ? "y needs" : "ies need"
                          } a budget`}
                          actionLabel="Review"
                          onAction={() => {
                            document
                              .getElementById("budget-group-flexible")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                        />
                      ) : (
                        <BudgetHelperRow
                          message="Review spending by category"
                          actionLabel="Review"
                          actionTo="/expenses"
                        />
                      )
                    }
                  />
                  <BudgetGroupCard
                    group={model.nonMonthly}
                    currency={activeCurrency}
                    emptyMessage="No yearly or irregular bills due in this cycle."
                    footer={
                      <BudgetHelperRow
                        message="Review non-monthly bills"
                        actionLabel="Review"
                        actionTo="/bills"
                      />
                    }
                  />
                  <BudgetTotalRow
                    label="Total expenses"
                    plannedCents={model.expensesTotals.plannedCents}
                    actualCents={model.expensesTotals.actualCents}
                    remainingCents={model.expensesTotals.remainingCents}
                    currency={activeCurrency}
                  />
                </div>
              </section>

              {/* Contributions */}
              <section className="budget-page-section" aria-label="Contributions">
                <BudgetSectionHeader title="Contributions" />
                <div className="budget-section-stack">
                  <BudgetGroupCard
                    group={model.contributions}
                    currency={activeCurrency}
                    emptyMessage="No savings goals yet."
                    footer={
                      model.contributions.plannedCents > 0 ? (
                        <BudgetHelperRow
                          message={
                            model.contributions.actualCents < model.contributions.plannedCents
                              ? "Allocate planned savings to goals"
                              : "View savings goals"
                          }
                          actionLabel={
                            model.contributions.actualCents < model.contributions.plannedCents
                              ? "Allocate"
                              : "Review"
                          }
                          onAction={
                            !isDemoMode &&
                            model.contributions.actualCents < model.contributions.plannedCents
                              ? () => setAllocateOpen(true)
                              : undefined
                          }
                          actionTo={
                            isDemoMode ||
                            model.contributions.actualCents >= model.contributions.plannedCents
                              ? "/goals"
                              : undefined
                          }
                        />
                      ) : (
                        <BudgetHelperRow
                          message="Set a monthly savings plan"
                          actionLabel="Review"
                          actionTo="/goals"
                        />
                      )
                    }
                  />
                  <BudgetTotalRow
                    label="Total contributions"
                    plannedCents={model.contributionsTotals.plannedCents}
                    actualCents={model.contributionsTotals.actualCents}
                    remainingCents={model.contributionsTotals.remainingCents}
                    currency={activeCurrency}
                  />
                </div>
              </section>
            </div>

            <aside className="budget-page-sidebar" aria-label="Budget summary">
              <BudgetSidebarLeftToBudgetCard
                leftToBudgetCents={model.leftToBudgetCents}
                currency={activeCurrency}
                onAssignMoney={handleAssignMoney}
                onAdjustIncome={!isDemoMode ? openIncomeEditor : undefined}
              />
              <BudgetSidebarSummaryTabs
                incomePlannedCents={model.incomeTotals.plannedCents}
                expensesPlannedCents={model.expensesTotals.plannedCents}
                contributionsPlannedCents={model.contributionsTotals.plannedCents}
                leftToBudgetCents={model.leftToBudgetCents}
                incomeActualCents={model.incomeTotals.actualCents}
                expensesActualCents={model.expensesTotals.actualCents}
                incomeRowCount={model.income.rows.length}
                expenseRowCount={expenseRowCount}
                currency={activeCurrency}
              />
            </aside>
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

      {!isDemoMode ? (
        <AllocateCycleSavingsDialog
          open={allocateOpen}
          onOpenChange={setAllocateOpen}
          goals={savingsGoals}
          currency={activeCurrency}
          plannedSavingsCents={savingsGoalAllocationCents}
          allocatedThisCycleCents={allocatedThisCycleCents}
          contributionsByGoal={contributionsByGoal}
          isSaving={isSavingCycleAllocation}
          onSave={async (payload) => {
            await saveCycleAllocation.mutateAsync(payload);
            setAllocateOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
