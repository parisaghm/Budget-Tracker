import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExpensesToolbar } from "@/components/expenses/ExpensesToolbar";
import { ExpenseCategoryFilters } from "@/components/expenses/ExpenseCategoryFilters";
import { ExpenseDateGroup } from "@/components/expenses/ExpenseDateGroup";
import { ExpenseDeleteDialog } from "@/components/expenses/ExpenseDeleteDialog";
import { ExpensesEmptyState } from "@/components/expenses/ExpensesEmptyState";
import {
  ExpenseInlineForm,
  type ExpenseFormMode,
  type ExpenseInlineSubmitPayload,
} from "@/components/expenses/ExpenseInlineForm";
import type { BudgetCycle } from "@/types/budgetCycle";
import type { Category, CategoryDef, Expense } from "@/types/finance";
import type {
  ExpensesCategoryFilter,
  ExpensesDateGroup as ExpensesDateGroupModel,
  ExpensesFilterChip,
} from "@/utils/expensesPageModel";
import { defaultExpenseDateForBudgetCycle } from "@/utils/budgetCycles";
import { toDateInputValue } from "@/utils/money";
import { cn } from "@/lib/utils";

interface ExpensesListCardProps {
  filteredCount: number;
  filteredTotalCents: number;
  currency: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filtersActive: boolean;
  hasSearch: boolean;
  chips: ExpensesFilterChip[];
  allCategories: ExpensesFilterChip[];
  selectedCategory: ExpensesCategoryFilter;
  showBillGeneratedOnly: boolean;
  showUncategorisedOnly: boolean;
  onSelectCategory: (category: ExpensesCategoryFilter) => void;
  onShowBillGeneratedOnlyChange: (value: boolean) => void;
  onShowUncategorisedOnlyChange: (value: boolean) => void;
  onClearFilters: () => void;
  onClearSearch: () => void;
  dateGroups: ExpensesDateGroupModel[];
  cycleExpenseCount: number;
  categories: CategoryDef[];
  monthScope: string;
  /** Selected income cycle — used so new expenses stamp today's date across month boundaries. */
  selectedCycle?: Pick<BudgetCycle, "startDate" | "endDate"> | null;
  onAddExpense: (expense: {
    amountCents: number;
    category: Category;
    date: string;
    note: string;
  }) => void | Promise<void>;
  onUpdate: (
    id: string,
    updates: Partial<Omit<Expense, "id" | "createdAt" | "budgetMonthId" | "month">>,
  ) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  className?: string;
}

function wouldBeHiddenByFilters(params: {
  note: string;
  category: Category;
  selectedCategory: ExpensesCategoryFilter;
  searchValue: string;
  showBillGeneratedOnly: boolean;
  showUncategorisedOnly: boolean;
  knownCategories: Set<string>;
}): boolean {
  const {
    note,
    category,
    selectedCategory,
    searchValue,
    showBillGeneratedOnly,
    showUncategorisedOnly,
    knownCategories,
  } = params;

  if (selectedCategory !== "all" && category !== selectedCategory) return true;
  if (showBillGeneratedOnly) return true; // new manual expense is never bill-generated
  if (showUncategorisedOnly && knownCategories.has(category)) return true;

  const q = searchValue.trim().toLowerCase();
  if (q) {
    const label = category.toLowerCase();
    const noteLower = note.toLowerCase();
    if (!noteLower.includes(q) && !label.includes(q) && !category.toLowerCase().includes(q)) {
      return true;
    }
  }
  return false;
}

export function ExpensesListCard({
  filteredCount,
  filteredTotalCents,
  currency,
  searchValue,
  onSearchChange,
  filtersActive,
  hasSearch,
  chips,
  allCategories,
  selectedCategory,
  showBillGeneratedOnly,
  showUncategorisedOnly,
  onSelectCategory,
  onShowBillGeneratedOnlyChange,
  onShowUncategorisedOnlyChange,
  onClearFilters,
  onClearSearch,
  dateGroups,
  cycleExpenseCount,
  categories,
  monthScope,
  selectedCycle = null,
  onAddExpense,
  onUpdate,
  onDelete,
  className,
}: ExpensesListCardProps) {
  const [mode, setMode] = useState<ExpenseFormMode>("closed");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  /** Captured when opening Add so the form date is fresh local today, not a stale submit-time value. */
  const [addFormDate, setAddFormDate] = useState(() =>
    defaultExpenseDateForBudgetCycle(selectedCycle, monthScope),
  );
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMode("closed");
    setEditingExpense(null);
    setIsSaving(false);
  }, [monthScope]);

  const closeForm = (restoreFocus = true) => {
    setMode("closed");
    setEditingExpense(null);
    if (restoreFocus) {
      window.setTimeout(() => addButtonRef.current?.focus(), 0);
    }
  };

  const openAdd = () => {
    setEditingExpense(null);
    setAddFormDate(defaultExpenseDateForBudgetCycle(selectedCycle, monthScope));
    setMode("adding");
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setMode("editing");
  };

  const handleAddClick = () => {
    if (mode === "adding") {
      closeForm();
      return;
    }
    // Switching from edit → add (never show both forms).
    openAdd();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await Promise.resolve(onDelete(deleteTarget.id));
      toast.success("Expense deleted");
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete expense";
      toast.error("Delete failed", { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeCategory = async (expense: Expense, category: Category) => {
    try {
      await Promise.resolve(onUpdate(expense.id, { category }));
      toast.success("Category updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update category";
      toast.error("Update failed", { description: message });
    }
  };

  const handleInlineSubmit = async (payload: ExpenseInlineSubmitPayload) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (mode === "editing" && payload.expenseId) {
        await Promise.resolve(
          onUpdate(payload.expenseId, {
            amountCents: payload.amountCents,
            category: payload.category,
            note: payload.note,
            date: toDateInputValue(payload.date) || payload.date,
          }),
        );
        toast.success("Expense updated");
        closeForm();
        return;
      }

      const date =
        toDateInputValue(payload.date) ||
        defaultExpenseDateForBudgetCycle(selectedCycle, monthScope);

      await Promise.resolve(
        onAddExpense({
          amountCents: payload.amountCents,
          category: payload.category,
          note: payload.note,
          date,
        }),
      );

      const known = new Set(categories.map((c) => c.value));
      const hidden = wouldBeHiddenByFilters({
        note: payload.note,
        category: payload.category,
        selectedCategory,
        searchValue,
        showBillGeneratedOnly,
        showUncategorisedOnly,
        knownCategories: known,
      });

      if (hidden) {
        toast.success("Expense added", {
          description: "It may be hidden by your current filters or search.",
        });
      } else {
        toast.success("Expense added");
      }
      closeForm();
    } catch (err) {
      // Re-throw so ExpenseInlineForm can keep values and show the error.
      throw err instanceof Error ? err : new Error("Could not save expense.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <section
        className={cn(
          "card-dashboard space-y-5 rounded-[1.5rem] border border-[#E8DFCC] p-5 sm:p-6",
          className,
        )}
      >
        <ExpensesToolbar
          filteredCount={filteredCount}
          filteredTotalCents={filteredTotalCents}
          currency={currency}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onAdd={handleAddClick}
          addButtonRef={addButtonRef}
          formOpen={mode !== "closed"}
          filtersActive={filtersActive}
        />

        {mode === "adding" || mode === "editing" ? (
          <ExpenseInlineForm
            key={
              mode === "editing"
                ? `edit-${editingExpense?.id ?? "unknown"}`
                : `add-${addFormDate}`
            }
            mode={mode}
            initialExpense={editingExpense}
            defaultTransactionDate={addFormDate}
            categories={categories}
            currency={currency}
            isPending={isSaving}
            onSubmit={handleInlineSubmit}
            onCancel={() => closeForm()}
          />
        ) : null}

        {cycleExpenseCount > 0 ? (
          <ExpenseCategoryFilters
            chips={chips}
            allCategories={allCategories}
            selectedCategory={selectedCategory}
            showBillGeneratedOnly={showBillGeneratedOnly}
            showUncategorisedOnly={showUncategorisedOnly}
            onSelectCategory={onSelectCategory}
            onShowBillGeneratedOnlyChange={onShowBillGeneratedOnlyChange}
            onShowUncategorisedOnlyChange={onShowUncategorisedOnlyChange}
            onClearFilters={onClearFilters}
          />
        ) : null}

        {cycleExpenseCount === 0 && mode === "closed" ? (
          <ExpensesEmptyState variant="no_expenses" onAdd={openAdd} />
        ) : cycleExpenseCount === 0 && mode !== "closed" ? null : filteredCount === 0 ? (
          <ExpensesEmptyState
            variant="no_results"
            onClearFilters={onClearFilters}
            onClearSearch={onClearSearch}
            hasSearch={hasSearch}
          />
        ) : (
          <div className="space-y-6">
            {dateGroups.map((group) => (
              <ExpenseDateGroup
                key={group.dateYmd}
                group={group}
                categories={categories}
                currency={currency}
                onEdit={openEdit}
                onChangeCategory={handleChangeCategory}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </section>

      <ExpenseDeleteDialog
        expense={deleteTarget}
        currency={currency}
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isConfirming={isDeleting}
      />
    </>
  );
}
