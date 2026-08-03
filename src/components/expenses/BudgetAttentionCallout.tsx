import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { ExpensesAttentionModel } from "@/utils/expensesPageModel";
import { cn } from "@/lib/utils";

interface BudgetAttentionCalloutProps {
  attention: ExpensesAttentionModel;
  hasPlannedExpenses: boolean;
}

const TONE_STYLES: Record<
  ExpensesAttentionModel["tone"],
  { wrap: string; dot: string }
> = {
  healthy: {
    wrap: "border-success/20 bg-success/[0.06]",
    dot: "bg-success",
  },
  near: {
    wrap: "border-warning/25 bg-warning/[0.07]",
    dot: "bg-warning",
  },
  over: {
    wrap: "border-destructive/20 bg-destructive/[0.06]",
    dot: "bg-destructive",
  },
  mixed: {
    wrap: "border-warning/25 bg-warning/[0.07]",
    dot: "bg-warning",
  },
  no_budget: {
    wrap: "border-[#E8DFCC] bg-[#F6F0E4]/70",
    dot: "bg-[#6E4E91]/55",
  },
};

export function BudgetAttentionCallout({
  attention,
  hasPlannedExpenses,
}: BudgetAttentionCalloutProps) {
  const tone = TONE_STYLES[attention.tone];
  const href = hasPlannedExpenses || attention.needsAction
    ? "/budget#budget-needs-attention"
    : "/budget#budget-section-expenses";
  const ctaLabel = hasPlannedExpenses ? "Open Budget" : "Set category budgets";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between",
        tone.wrap,
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
        <p className="text-sm font-medium leading-snug text-foreground">{attention.message}</p>
      </div>
      <Link
        to={href}
        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-[#6E4E91]/30 bg-[#FFFDF8] px-3 py-2 text-sm font-semibold text-[#6E4E91] transition-colors hover:bg-[#EFE7F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
