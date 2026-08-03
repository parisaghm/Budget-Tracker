import type { Ref } from "react";
import { Search, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";

interface ExpensesToolbarProps {
  filteredCount: number;
  filteredTotalCents: number;
  currency: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  addButtonRef?: Ref<HTMLButtonElement>;
  /** When true, Add is visually active (inline form open). */
  formOpen?: boolean;
  filtersActive: boolean;
  className?: string;
}

export function ExpensesToolbar({
  filteredCount,
  filteredTotalCents,
  currency,
  searchValue,
  onSearchChange,
  onAdd,
  addButtonRef,
  formOpen = false,
  filtersActive,
  className,
}: ExpensesToolbarProps) {
  const entryLabel = filteredCount === 1 ? "1 entry" : `${filteredCount} entries`;
  const subtitle = filtersActive
    ? `${entryLabel} · ${formatMoney(filteredTotalCents, currency)} matching`
    : `${entryLabel} · ${formatMoney(filteredTotalCents, currency)} this cycle`;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <header className="min-w-0">
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Expenses
        </h2>
        <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
          {subtitle}
        </p>
      </header>

      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:max-w-md">
        <div className="relative min-w-0 flex-1 sm:w-56">
          <label htmlFor="expenses-search" className="sr-only">
            Search expenses
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="expenses-search"
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search expenses"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-[#E8DFCC] bg-[#FFFDF8] py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-[#F6F0E4] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <Button
          ref={addButtonRef}
          type="button"
          onClick={onAdd}
          aria-expanded={formOpen}
          className={cn(
            "h-11 shrink-0 gap-1.5 rounded-xl px-4 text-sm font-semibold",
            formOpen
              ? "border border-[#6E4E91]/40 bg-[#EFE7F7] text-[#6E4E91] hover:bg-[#EFE7F7]/80"
              : "bg-[#6E4E91] text-primary-foreground hover:bg-[#5B3F7A]",
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>
    </div>
  );
}
