import { formatMoney, formatMonthNameOnly } from "@/utils/money";

export interface MoneyFlowSummaryProps {
  currentMonth: string;
  previousMonthKey: string;
  currency: string;
  salaryCents: number;
  /** Rollover the user chose to add to this month's budget. */
  rolloverBoostCents: number;
  /** Unspent from prior month when still undecided. */
  previousLeftoverCents: number;
  rolloverPending: boolean;
  savingsAllocationCents: number;
  fixedBillsCents: number;
  spentSoFarCents: number;
  /** Safe-to-spend / money left this month. */
  remainingCents: number;
  weeklySafeToSpendCents: number;
  weeksRemaining: number;
}

function FlowAmount({
  cents,
  currency,
  sign,
}: {
  cents: number;
  currency: string;
  sign: "plus" | "minus";
}) {
  if (cents <= 0) return null;
  return (
    <span
      className={`money-display shrink-0 text-sm font-semibold tabular-nums ${
        sign === "minus" ? "text-muted-foreground" : "text-foreground"
      }`}
    >
      {sign === "minus" ? "−" : "+"}
      {formatMoney(cents, currency)}
    </span>
  );
}

function FlowRow({
  label,
  hint,
  cents,
  currency,
  sign,
}: {
  label: string;
  hint?: string;
  cents: number;
  currency: string;
  sign: "plus" | "minus";
}) {
  if (cents <= 0 && sign === "minus") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0 text-left">
        <p className="text-sm text-foreground">{label}</p>
        {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      <FlowAmount cents={cents} currency={currency} sign={sign} />
    </div>
  );
}

export function MoneyFlowSummary({
  currentMonth,
  previousMonthKey,
  currency,
  salaryCents,
  rolloverBoostCents,
  previousLeftoverCents,
  rolloverPending,
  savingsAllocationCents,
  fixedBillsCents,
  spentSoFarCents,
  remainingCents,
  weeklySafeToSpendCents,
  weeksRemaining,
}: MoneyFlowSummaryProps) {
  const monthName = formatMonthNameOnly(currentMonth);
  const previousMonthName = formatMonthNameOnly(previousMonthKey);
  const hasIncome = salaryCents > 0;
  const hasOutflows =
    savingsAllocationCents > 0 || fixedBillsCents > 0 || spentSoFarCents > 0;
  const isOver = remainingCents < 0;

  if (!hasIncome) {
    return (
      <div className="card-elevated space-y-2 p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Where your money went
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Add your monthly income above to see a plain-language breakdown of where your money goes
          this month.
        </p>
      </div>
    );
  }

  return (
    <div className="card-elevated space-y-4 p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Where your money went
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          This month you received{" "}
          <span className="font-semibold text-foreground">{formatMoney(salaryCents, currency)}</span>
          .
        </p>
      </div>

      <div className="rounded-2xl bg-muted/40 px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          You started {monthName} with
        </p>
        <div className="mt-2 space-y-1">
          <FlowRow label="Income" hint="Your monthly income" cents={salaryCents} currency={currency} sign="plus" />
          {rolloverBoostCents > 0 ? (
            <FlowRow
              label={`Money carried from ${previousMonthName}`}
              hint="Unused money from your previous month"
              cents={rolloverBoostCents}
              currency={currency}
              sign="plus"
            />
          ) : null}
        </div>
        {rolloverPending ? (
          <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
            You also have {formatMoney(previousLeftoverCents, currency)} left from {previousMonthName}{" "}
            — decide above whether to use it this month.
          </p>
        ) : null}
      </div>

      {hasOutflows ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Then</p>
          <div className="mt-2 space-y-1 rounded-2xl border border-border/50 px-4 py-3">
            <FlowRow
              label="Moved to savings"
              hint="Planned monthly contributions to your goals"
              cents={savingsAllocationCents}
              currency={currency}
              sign="minus"
            />
            <FlowRow
              label="Upcoming bills"
              hint="Due before your income date"
              cents={fixedBillsCents}
              currency={currency}
              sign="minus"
            />
            <FlowRow
              label="Spent so far"
              hint="Already spent this month"
              cents={spentSoFarCents}
              currency={currency}
              sign="minus"
            />
          </div>
        </div>
      ) : null}

      <div className="border-t border-border/60 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">You now have</p>
        <p
          className={`money-display mt-1 text-2xl font-bold sm:text-3xl ${
            isOver ? "text-destructive" : "text-foreground"
          }`}
        >
          {formatMoney(remainingCents, currency)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isOver
            ? "Over your plan for this month after savings, bills, and spending."
            : "left for this month — money still available after savings and bills."}
        </p>
        {!isOver && weeklySafeToSpendCents > 0 && weeksRemaining > 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            That works out to about{" "}
            <span className="font-semibold">{formatMoney(weeklySafeToSpendCents, currency)}</span> per week for
            the next {weeksRemaining} week{weeksRemaining === 1 ? "" : "s"}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
