import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { AppShellHeader } from "@/components/AppShellHeader";
import { AppPageContainer } from "@/components/AppPageContainer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { ExpensesCycleSummaryCard } from "@/components/expenses/ExpensesCycleSummaryCard";
import { ExpensesListCard } from "@/components/expenses/ExpensesListCard";
import {
  buildExpensesPageModel,
  type ExpensesCategoryFilter,
} from "@/utils/expensesPageModel";

const SEARCH_DEBOUNCE_MS = 250;

export default function ExpensesPage() {
  const {
    currentMonth,
    setCurrentMonth,
    budget,
    expenses,
    totalSpentCents,
    addExpense,
    updateExpense,
    deleteExpense,
    allCategories,
    incomeCycle,
    selectedCycle,
    categoryLimitsForMonth,
  } = useSupabaseFinanceData();

  const [selectedCategory, setSelectedCategory] = useState<ExpensesCategoryFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showBillGeneratedOnly, setShowBillGeneratedOnly] = useState(false);
  const [showUncategorisedOnly, setShowUncategorisedOnly] = useState(false);

  const activeCurrency = budget?.currency ?? "EUR";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Reset filters when the selected cycle changes so stale filters never linger.
  useEffect(() => {
    setSelectedCategory("all");
    setSearchInput("");
    setDebouncedSearch("");
    setShowBillGeneratedOnly(false);
    setShowUncategorisedOnly(false);
  }, [selectedCycle?.id, currentMonth]);

  const model = useMemo(
    () =>
      buildExpensesPageModel({
        expenses,
        categories: allCategories,
        categoryLimits: categoryLimitsForMonth,
        selectedCategory,
        searchQuery: debouncedSearch,
        showBillGeneratedOnly,
        showUncategorisedOnly,
        homeSpentCents: totalSpentCents,
      }),
    [
      expenses,
      allCategories,
      categoryLimitsForMonth,
      selectedCategory,
      debouncedSearch,
      showBillGeneratedOnly,
      showUncategorisedOnly,
      totalSpentCents,
    ],
  );

  const clearFilters = () => {
    setSelectedCategory("all");
    setShowBillGeneratedOnly(false);
    setShowUncategorisedOnly(false);
  };

  return (
    <>
      <Helmet>
        <title>Expenses · Sova Budget</title>
        <meta
          name="description"
          content="Review cycle spending by category and manage your expenses."
        />
      </Helmet>
      <div className="flex min-h-dvh flex-col bg-background">
        <AppShellHeader
          title="Expenses"
          subtitle="Where your money went this cycle"
          currency={activeCurrency}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          incomeCycle={incomeCycle}
          selectedCycle={selectedCycle}
        />
        <AppPageContainer
          as="main"
          className="flex-1 pb-mobile-nav pr-mobile-fab pt-5 sm:pt-8 md:pb-10"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,34%)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <ExpensesListCard
              className="order-1 lg:order-2"
              filteredCount={model.filteredCount}
              filteredTotalCents={model.filteredTotalCents}
              currency={activeCurrency}
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              filtersActive={model.hasActiveFilters}
              hasSearch={model.hasSearch}
              chips={model.visibleFilterChips}
              allCategories={model.allFilterCategories}
              selectedCategory={selectedCategory}
              showBillGeneratedOnly={showBillGeneratedOnly}
              showUncategorisedOnly={showUncategorisedOnly}
              onSelectCategory={setSelectedCategory}
              onShowBillGeneratedOnlyChange={setShowBillGeneratedOnly}
              onShowUncategorisedOnlyChange={setShowUncategorisedOnly}
              onClearFilters={clearFilters}
              onClearSearch={() => setSearchInput("")}
              dateGroups={model.dateGroups}
              cycleExpenseCount={expenses.length}
              categories={allCategories}
              monthScope={currentMonth}
              selectedCycle={selectedCycle}
              onAddExpense={addExpense}
              onUpdate={updateExpense}
              onDelete={deleteExpense}
            />

            <div className="order-2 lg:order-1 lg:sticky lg:top-24">
              <ExpensesCycleSummaryCard
                breakdown={model.categoryBreakdown}
                visibleRows={model.visibleCategoryRows}
                hasMoreCategories={model.hasMoreCategories}
                totalCycleSpendingCents={model.totalCycleSpendingCents}
                plannedExpenseTotalCents={model.plannedExpenseTotalCents}
                hasPlannedExpenses={model.hasPlannedExpenses}
                selectedCategory={selectedCategory}
                selectedBreakdown={model.selectedBreakdown}
                attention={model.attention}
                currency={activeCurrency}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          </div>
        </AppPageContainer>

        <QuickAddExpenseSheet
          currency={activeCurrency}
          categories={allCategories}
          budgetMonth={currentMonth}
          selectedCycle={selectedCycle}
          onAdd={addExpense}
        />
        <MobileBottomNav />
      </div>
    </>
  );
}
