import { Pencil } from "lucide-react";
import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";

export interface BudgetAllocationStripProps {
  currency: string;
  incomeCents: number;
  assignedCents: number;
  unassignedCents: number;
  assignmentProgressPct: number;
  isOverAssigned: boolean;
  onAdjustIncome?: () => void;
}

export function BudgetAllocationStrip({
  currency,
  incomeCents,
  assignedCents,
  unassignedCents,
  assignmentProgressPct,
  isOverAssigned,
  onAdjustIncome,
}: BudgetAllocationStripProps) {
  const hasIncome = incomeCents > 0;
  const progressWidth = hasIncome ? Math.min(assignmentProgressPct, 100) : 0;
  const unassignedDisplay = isOverAssigned ? 0 : Math.max(0, unassignedCents);

  return (
    <section
      className="budget-allocation-strip w-full rounded-xl border border-border/50 bg-card/40 p-3"
      aria-labelledby="budget-allocation-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="budget-allocation-heading" className="heading-card text-base">
          Allocation
        </h2>
        {onAdjustIncome ? (
          <button
            type="button"
            onClick={onAdjustIncome}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Pencil className="h-3 w-3 opacity-70" aria-hidden />
            Adjust income
          </button>
        ) : null}
      </div>

      {!hasIncome ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Add your monthly income to allocate across categories.
        </p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <AllocationStat label="Income" value={formatMoney(incomeCents, currency)} />
            <AllocationStat label="Assigned" value={formatMoney(assignedCents, currency)} />
            <AllocationStat
              label="Unassigned"
              value={formatMoney(unassignedDisplay, currency)}
              tone={isOverAssigned ? "over" : unassignedDisplay > 0 ? "positive" : "muted"}
              hint={
                isOverAssigned
                  ? `${formatMoney(assignedCents - incomeCents, currency)} over`
                  : undefined
              }
            />
          </div>

          <div className="mt-2">
            <div className="progress-track h-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all duration-700 ease-out",
                  isOverAssigned ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            <div className="mt-1 flex justify-end">
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  isOverAssigned ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {assignmentProgressPct}% assigned
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AllocationStat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "over" | "positive" | "muted";
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="label-caps text-[9px] tracking-[0.12em]">{label}</p>
      <p
        className={cn(
          "money-display mt-0.5 truncate text-sm font-semibold tabular-nums",
          tone === "over" && "text-destructive",
          tone === "positive" && "text-success",
          tone === "muted" && "text-muted-foreground",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] font-medium text-destructive">{hint}</p> : null}
    </div>
  );
}
