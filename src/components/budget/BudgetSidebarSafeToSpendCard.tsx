import { Shield } from "lucide-react";
import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";

export interface BudgetSidebarSafeToSpendCardProps {
  safeToSpendCents: number | null;
  incomeReceivedCents: number;
  actualSpendingCents: number;
  upcomingUnpaidBillsCents: number;
  plannedSavingsCents: number;
  currency?: string;
  hasIncomeForCycle?: boolean;
  className?: string;
}

export function BudgetSidebarSafeToSpendCard({
  safeToSpendCents,
  incomeReceivedCents,
  actualSpendingCents,
  upcomingUnpaidBillsCents,
  plannedSavingsCents,
  currency = "EUR",
  hasIncomeForCycle = true,
  className,
}: BudgetSidebarSafeToSpendCardProps) {
  const available = hasIncomeForCycle && safeToSpendCents != null;
  const total = safeToSpendCents ?? 0;
  const totalTone =
    !available ? "text-muted-foreground" : total < 0 ? "text-destructive" : "text-success";

  return (
    <section
      className={cn(
        "card-dashboard rounded-[1.5rem] border border-border/70 p-5 lg:rounded-[1.75rem] lg:p-6",
        className,
      )}
      aria-labelledby="safe-to-spend-budget-heading"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-primary">
          <Shield className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="label-caps text-[10px] tracking-[0.1em] text-muted-foreground">
          Decision support
        </p>
      </div>

      <h2
        id="safe-to-spend-budget-heading"
        className="mt-3 font-display text-lg font-semibold text-foreground"
      >
        Safe to Spend{" "}
        <span className={cn("tabular-nums", totalTone)}>
          {available ? formatMoney(total, currency) : "—"}
        </span>
      </h2>
      <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
        Money you can still spend this cycle after spending, bills, and planned savings.
      </p>

      <ul className="mt-4 space-y-2 text-sm" role="list">
        <BreakdownLine
          label="Income received"
          amountCents={incomeReceivedCents}
          currency={currency}
          kind="income"
        />
        <BreakdownLine
          label="Actual spending"
          amountCents={actualSpendingCents}
          currency={currency}
          kind="deduction"
        />
        <BreakdownLine
          label="Upcoming unpaid bills"
          amountCents={upcomingUnpaidBillsCents}
          currency={currency}
          kind="deduction"
        />
        <BreakdownLine
          label="Planned savings"
          amountCents={plannedSavingsCents}
          currency={currency}
          kind="deduction"
        />
        <li className="border-t border-border/70 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-foreground">Safe to Spend</span>
            <span className={cn("money-display font-semibold tabular-nums", totalTone)}>
              {available ? formatMoney(total, currency) : "Not available"}
            </span>
          </div>
        </li>
      </ul>
    </section>
  );
}

function BreakdownLine({
  label,
  amountCents,
  currency,
  kind,
}: {
  label: string;
  amountCents: number;
  currency: string;
  kind: "income" | "deduction";
}) {
  const prefix = kind === "deduction" ? "− " : "";
  return (
    <li className="flex items-baseline justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="money-display tabular-nums text-foreground/90">
        {prefix}
        {formatMoney(amountCents, currency)}
      </span>
    </li>
  );
}
