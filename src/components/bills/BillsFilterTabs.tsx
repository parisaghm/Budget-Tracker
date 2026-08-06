import { cn } from "@/lib/utils";

export type BillsFilter = "all" | "this-week" | "recurring" | "one-time" | "overdue";

export interface BillsFilterOption {
  value: BillsFilter;
  label: string;
  count: number;
}

interface BillsFilterTabsProps {
  active: BillsFilter;
  options: BillsFilterOption[];
  onChange: (value: BillsFilter) => void;
  className?: string;
}

export function BillsFilterTabs({ active, options, onChange, className }: BillsFilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter bills"
      className={cn(
        "-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "touch-hit shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-primary",
            )}
          >
            {option.label}
            {option.count > 0 ? (
              <span className={cn("ml-1.5 text-xs", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
