import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyVariant = "no_expenses" | "no_results";

interface ExpensesEmptyStateProps {
  variant: EmptyVariant;
  onAdd?: () => void;
  onClearFilters?: () => void;
  onClearSearch?: () => void;
  hasSearch?: boolean;
}

export function ExpensesEmptyState({
  variant,
  onAdd,
  onClearFilters,
  onClearSearch,
  hasSearch,
}: ExpensesEmptyStateProps) {
  if (variant === "no_results") {
    return (
      <div className="rounded-2xl border border-dashed border-[#E8DFCC] bg-[#F6F0E4]/40 px-5 py-10 text-center">
        <h3 className="font-display text-lg font-semibold text-foreground">
          No expenses match these filters.
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Try another category, clear search, or reset filters.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onClearFilters ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-[#E8DFCC]"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : null}
          {hasSearch && onClearSearch ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-[#E8DFCC]"
              onClick={onClearSearch}
            >
              Clear search
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#E8DFCC] bg-[#F6F0E4]/40 px-5 py-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFDF8] border border-[#E8DFCC]">
        <ReceiptText className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">
        No expenses recorded this cycle
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Add your first expense to start seeing your spending breakdown.
      </p>
      {onAdd ? (
        <Button
          type="button"
          onClick={onAdd}
          className="mt-5 rounded-xl bg-[#6E4E91] hover:bg-[#5B3F7A]"
        >
          Add expense
        </Button>
      ) : null}
    </div>
  );
}
