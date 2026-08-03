import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import type { Category, CategoryDef, Expense } from "@/types/finance";
import type { ExpensesDateGroup as ExpensesDateGroupModel } from "@/utils/expensesPageModel";
import { formatMoney } from "@/utils/money";

interface ExpenseDateGroupProps {
  group: ExpensesDateGroupModel;
  categories: CategoryDef[];
  currency: string;
  onEdit: (expense: Expense) => void;
  onChangeCategory: (expense: Expense, category: Category) => void | Promise<void>;
  onDelete: (expense: Expense) => void;
}

export function ExpenseDateGroup({
  group,
  categories,
  currency,
  onEdit,
  onChangeCategory,
  onDelete,
}: ExpenseDateGroupProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {group.heading}
        </h3>
        <p className="text-xs font-semibold tabular-nums text-muted-foreground">
          −{formatMoney(group.dayTotalCents, currency)}
        </p>
      </div>
      <ul className="space-y-2">
        {group.expenses.map((expense) => (
          <li key={expense.id}>
            <ExpenseRow
              expense={expense}
              categories={categories}
              currency={currency}
              onEdit={() => onEdit(expense)}
              onChangeCategory={(category) => onChangeCategory(expense, category)}
              onDelete={() => onDelete(expense)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
