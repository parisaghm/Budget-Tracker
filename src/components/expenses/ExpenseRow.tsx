import { CategoryEmojiIcon } from "@/components/icons/CategoryEmojiIcon";
import { ExpenseActionsMenu } from "@/components/expenses/ExpenseActionsMenu";
import type { Category, CategoryDef, Expense } from "@/types/finance";
import { getCategoryLabel } from "@/types/finance";
import { formatMoney } from "@/utils/money";

interface ExpenseRowProps {
  expense: Expense;
  categories: CategoryDef[];
  currency: string;
  onEdit: () => void;
  onChangeCategory: (category: Category) => void | Promise<void>;
  onDelete: () => void;
}

export function ExpenseRow({
  expense,
  categories,
  currency,
  onEdit,
  onChangeCategory,
  onDelete,
}: ExpenseRowProps) {
  const customCats = categories.filter((c) => c.isCustom);
  const categoryLabel = getCategoryLabel(expense.category, customCats);
  const categoryDef = categories.find((c) => c.value === expense.category);
  const title = expense.note?.trim() || "Untitled expense";

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-[#E8DFCC] bg-[#FFFDF8] px-3 py-3 sm:px-4">
      <CategoryEmojiIcon
        categoryValue={expense.category}
        iconKey={categoryDef?.iconKey}
        label={categoryLabel}
        decorative
        className="h-10 w-10 rounded-full"
        iconClassName="h-5 w-5"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{categoryLabel}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground sm:text-base">
        −{formatMoney(expense.amountCents, currency)}
      </p>
      <ExpenseActionsMenu
        expense={expense}
        categories={categories}
        onEdit={onEdit}
        onChangeCategory={onChangeCategory}
        onDelete={onDelete}
      />
    </article>
  );
}
