import { CategoryEmojiIcon } from "@/components/icons/CategoryEmojiIcon";
import { formatMoney } from "@/utils/money";
import type { ExpensesCategoryBreakdownItem } from "@/utils/expensesPageModel";
import { cn } from "@/lib/utils";

interface SpendingCategoryRowProps {
  item: ExpensesCategoryBreakdownItem;
  currency: string;
  selected: boolean;
  onSelect: () => void;
}

export function SpendingCategoryRow({
  item,
  currency,
  selected,
  onSelect,
}: SpendingCategoryRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
        "hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        selected && "bg-accent ring-1 ring-primary/25",
      )}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
        style={{ backgroundColor: item.color }}
        aria-hidden
      />
      <CategoryEmojiIcon
        categoryValue={item.categoryValue}
        iconKey={item.iconKey}
        label={item.categoryLabel}
        decorative
        className="h-7 w-7"
        iconClassName="h-4 w-4"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {item.categoryLabel}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatMoney(item.spentCents, currency)}
      </span>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {item.percentOfTotal}%
      </span>
    </button>
  );
}
