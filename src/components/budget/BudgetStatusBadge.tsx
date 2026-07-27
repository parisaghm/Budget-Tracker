import { cn } from "@/lib/utils";

export interface BudgetStatusBadgeProps {
  count: number;
  className?: string;
}

export function BudgetStatusBadge({ count, className }: BudgetStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground",
        className,
      )}
      aria-label={`${count} items`}
    >
      {count}
    </span>
  );
}
