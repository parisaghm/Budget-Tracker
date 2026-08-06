import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CategoryEmojiIcon } from "@/components/icons/CategoryEmojiIcon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ExpensesCategoryFilter, ExpensesFilterChip } from "@/utils/expensesPageModel";
import { cn } from "@/lib/utils";

interface ExpenseCategoryFiltersProps {
  chips: ExpensesFilterChip[];
  allCategories: ExpensesFilterChip[];
  selectedCategory: ExpensesCategoryFilter;
  showBillGeneratedOnly: boolean;
  showUncategorisedOnly: boolean;
  onSelectCategory: (category: ExpensesCategoryFilter) => void;
  onShowBillGeneratedOnlyChange: (value: boolean) => void;
  onShowUncategorisedOnlyChange: (value: boolean) => void;
  onClearFilters: () => void;
}

function FilterChipButton({
  chip,
  selected,
  onSelect,
}: {
  chip: ExpensesFilterChip;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-popover text-foreground hover:bg-card",
      )}
    >
      {chip.value !== "all" && chip.iconKey ? (
        <CategoryEmojiIcon
          categoryValue={String(chip.value)}
          iconKey={chip.iconKey}
          label={chip.label}
          decorative
          className="h-5 w-5 rounded-md"
          iconClassName="h-3 w-3"
        />
      ) : null}
      {chip.label}
    </button>
  );
}

export function ExpenseCategoryFilters({
  chips,
  allCategories,
  selectedCategory,
  showBillGeneratedOnly,
  showUncategorisedOnly,
  onSelectCategory,
  onShowBillGeneratedOnlyChange,
  onShowUncategorisedOnlyChange,
  onClearFilters,
}: ExpenseCategoryFiltersProps) {
  const [open, setOpen] = useState(false);
  const moreActive = showBillGeneratedOnly || showUncategorisedOnly;

  const selectedChipLabel =
    chips.find((c) => c.value === selectedCategory)?.label ??
    allCategories.find((c) => c.value === selectedCategory)?.label ??
    selectedCategory;

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-2"
        role="toolbar"
        aria-label="Category filters"
      >
        {chips.map((chip) => (
          <FilterChipButton
            key={String(chip.value)}
            chip={chip}
            selected={selectedCategory === chip.value}
            onSelect={() => {
              if (chip.value === "all") {
                onSelectCategory("all");
                return;
              }
              onSelectCategory(selectedCategory === chip.value ? "all" : chip.value);
            }}
          />
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                moreActive || open
                  ? "border-primary/40 bg-accent text-primary"
                  : "border-border bg-popover text-foreground hover:bg-card",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              More filters
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-border bg-popover p-4 shadow-md"
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  All categories
                </p>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto overscroll-contain">
                  {allCategories.map((chip) => {
                    const selected = selectedCategory === chip.value;
                    return (
                      <button
                        key={String(chip.value)}
                        type="button"
                        onClick={() => {
                          onSelectCategory(selected ? "all" : chip.value);
                          setOpen(false);
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium",
                          "hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          selected && "bg-accent text-primary",
                        )}
                      >
                        <CategoryEmojiIcon
                          categoryValue={String(chip.value)}
                          iconKey={chip.iconKey}
                          label={chip.label}
                          decorative
                          className="h-7 w-7"
                          iconClassName="h-4 w-4"
                        />
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Special filters
                </p>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-card">
                  <input
                    type="checkbox"
                    checked={showUncategorisedOnly}
                    onChange={(e) => onShowUncategorisedOnlyChange(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring/40"
                  />
                  Uncategorised only
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-card">
                  <input
                    type="checkbox"
                    checked={showBillGeneratedOnly}
                    onChange={(e) => onShowBillGeneratedOnlyChange(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring/40"
                  />
                  Bill-generated expenses
                </label>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-xl border-border"
                onClick={() => {
                  onClearFilters();
                  setOpen(false);
                }}
              >
                Clear filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <p className="sr-only" aria-live="polite">
        {selectedCategory === "all"
          ? "Showing all categories"
          : `Filtered by ${selectedChipLabel}`}
        {showBillGeneratedOnly ? ". Bill-generated only." : ""}
        {showUncategorisedOnly ? ". Uncategorised only." : ""}
      </p>
    </div>
  );
}
