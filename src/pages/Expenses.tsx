import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { AppShellHeader } from "@/components/AppShellHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ExpenseList } from "@/components/ExpenseList";
import { CategoryChart } from "@/components/CategoryChart";
import type { Category } from "@/types/finance";

export default function ExpensesPage() {
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const {
    currentMonth,
    setCurrentMonth,
    budget,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    allCategories,
    addCustomCategory,
    deleteCategory,
    categoryLimitsForMonth,
    setCategoryLimit,
  } = useSupabaseFinanceData();

  const activeCurrency = budget?.currency ?? "EUR";

  return (
    <>
      <Helmet>
        <title>Expenses · Sova Budget</title>
        <meta name="description" content="Log spending and see category breakdowns." />
      </Helmet>
      <div className="min-h-screen bg-background">
        <AppShellHeader
          title="Expenses"
          subtitle="Log spending when it happens"
          currency={activeCurrency}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          contentMaxWidth="max-w-6xl"
        />
        <main className="container max-w-6xl space-y-5 px-4 pb-mobile-nav pr-mobile-fab pt-5 sm:px-6 sm:pt-8 md:pb-10 md:pr-4 lg:px-8">
          <p className="text-sm text-muted-foreground md:hidden">
            Use the + button to add an expense quickly.
          </p>
          <div className="hidden md:block">
            <ExpenseForm
              currency={activeCurrency}
              budgetMonth={currentMonth}
              onAdd={addExpense}
              categories={allCategories}
              expenses={expenses}
              onAddCategory={addCustomCategory}
              onDeleteCategory={deleteCategory}
            />
          </div>
          <CategoryChart
            expenses={expenses}
            categories={allCategories}
            currency={activeCurrency}
            selectedCategory={categoryFilter === "all" ? null : categoryFilter}
            onCategorySelect={(cat) => setCategoryFilter(cat ?? "all")}
            categoryLimits={categoryLimitsForMonth}
            onSetCategoryLimit={setCategoryLimit}
          />
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
