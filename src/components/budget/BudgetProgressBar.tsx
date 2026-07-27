import { cn } from "@/lib/utils";
import type { BudgetRowStatus } from "@/utils/budgetPageModel";
import { budgetRowBarTone } from "@/utils/budgetPageModel";

const TONE_CLASS: Record<ReturnType<typeof budgetRowBarTone>, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  primary: "bg-primary",
  muted: "bg-muted-foreground/35",
};

export interface BudgetProgressBarProps {
  progressPct: number;
  status: BudgetRowStatus;
  className?: string;
  /** When false, hide the track (e.g. zero planned and zero actual). */
  visible?: boolean;
}

export function BudgetProgressBar({
  progressPct,
  status,
  className,
  visible = true,
}: BudgetProgressBarProps) {
  if (!visible) return null;
  const tone = budgetRowBarTone(status);
  const width = Math.min(100, Math.max(0, progressPct));

  return (
    <div
      className={cn("budget-progress-track h-1 w-full overflow-hidden rounded-full bg-muted/70", className)}
      aria-hidden
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", TONE_CLASS[tone])}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
