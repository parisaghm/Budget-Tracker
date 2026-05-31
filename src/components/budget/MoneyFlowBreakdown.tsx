import type { ReactNode } from "react";
import { formatMoney, formatMonthNameOnly } from "@/utils/money";
import type { MonthBudgetPlan } from "@/utils/budgetPlanner";

function FlowSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="label-caps">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function BudgetLine({
  label,
  value,
  currency,
  hint,
  emphasis,
  prefix,
}: {
  label: string;
  value: number;
  currency: string;
  hint?: string;
  emphasis?: boolean;
  prefix?: "+" | "−";
}) {
  if (value <= 0 && prefix === "−") return null;

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 ${
        emphasis ? "bg-primary/5 ring-1 ring-primary/15" : "bg-muted/50"
      }`}
    >
      <div className="min-w-0">
        <p className={`text-sm ${emphasis ? "font-medium text-foreground" : "text-muted-foreground"}`}>
          {label}
        </p>
        {hint ? <p className="text-xs leading-relaxed text-muted-foreground/80">{hint}</p> : null}
      </div>
      <span
        className={`money-display shrink-0 text-sm font-semibold tabular-nums ${
          emphasis ? "text-foreground" : "text-foreground"
        }`}
      >
        {prefix ? `${prefix}${formatMoney(value, currency)}` : formatMoney(value, currency)}
      </span>
    </div>
  );
}

export interface MoneyFlowBreakdownProps {
  plan: MonthBudgetPlan;
  currency: string;
  previousMonthKey: string;
  previousLeftoverCents: number;
  rolloverPending: boolean;
  adjustedSafeToSpendCents: number;
  weeklySafeToSpendCents: number;
  weeklyReductionCents?: number;
  recurringBillsCount: number;
}

export function MoneyFlowBreakdown({
  plan,
  currency,
  previousMonthKey,
  previousLeftoverCents,
  rolloverPending,
  adjustedSafeToSpendCents,
  weeklySafeToSpendCents,
  weeklyReductionCents = 0,
  recurringBillsCount,
}: MoneyFlowBreakdownProps) {
  const previousMonthName = formatMonthNameOnly(previousMonthKey);

  return (
    <div className="card-elevated space-y-5 p-4 sm:p-5">
      <div>
        <p className="label-caps">Money flow</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Income → set aside → spending → what is left
        </p>
      </div>

      <FlowSection title="Money in" subtitle="What came into this month">
        <BudgetLine
          label="Monthly income"
          value={plan.monthlyIncomeCents}
          currency={currency}
          hint="Your income for this month"
          prefix="+"
        />
        {plan.rolloverBoostCents > 0 ? (
          <BudgetLine
            label={`Money carried from ${previousMonthName}`}
            value={plan.rolloverBoostCents}
            currency={currency}
            hint="Unused money from your previous month"
            prefix="+"
          />
        ) : rolloverPending ? (
          <div className="rounded-xl bg-muted/40 px-3 py-2.5">
            <p className="text-sm text-muted-foreground">
              {formatMoney(previousLeftoverCents, currency)} left from {previousMonthName}
            </p>
            <p className="text-xs text-muted-foreground/80">Not added yet — decide in the prompt above</p>
          </div>
        ) : null}
        {plan.effectiveIncomeCents > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-border/60 px-1 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Total to work with</p>
            <span className="money-display text-sm font-bold text-foreground">
              {formatMoney(plan.effectiveIncomeCents, currency)}
            </span>
          </div>
        ) : null}
      </FlowSection>

      <div className="border-t border-border/50" />

      <FlowSection title="Set aside" subtitle="Committed before day-to-day spending">
        <BudgetLine
          label="Savings allocation"
          value={plan.savingsAllocationCents}
          currency={currency}
          hint="Planned monthly contributions"
          prefix="−"
        />
        <BudgetLine
          label="Upcoming bills"
          value={plan.fixedBillsCents}
          currency={currency}
          hint={`${recurringBillsCount} recurring bill${recurringBillsCount === 1 ? "" : "s"} due before your income date`}
          prefix="−"
        />
        {plan.flexibleSpendingCents > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-border/60 px-1 pt-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">For flexible spending</p>
              <p className="text-xs text-muted-foreground/80">After savings and bills</p>
            </div>
            <span className="money-display text-sm font-semibold text-foreground">
              {formatMoney(plan.flexibleSpendingCents, currency)}
            </span>
          </div>
        ) : null}
      </FlowSection>

      <div className="border-t border-border/50" />

      <FlowSection title="Spending" subtitle="What you have already used">
        <BudgetLine
          label="Spent so far"
          value={plan.spentSoFarCents}
          currency={currency}
          hint="Already spent this month"
          prefix="−"
        />
      </FlowSection>

      <div className="border-t border-border/50" />

      <FlowSection title="What's left" subtitle="How the final number is calculated">
        <BudgetLine
          label="Remaining this month"
          value={plan.remainingThisMonthCents}
          currency={currency}
          hint="After savings and bills, before spending"
        />
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">Calculation</p>
          <p className="text-right text-xs leading-relaxed text-muted-foreground">
            Income + carried − bills − savings − spent
          </p>
        </div>
        <BudgetLine
          label="Safe to spend"
          value={adjustedSafeToSpendCents}
          currency={currency}
          hint={
            plan.rolloverBoostCents > 0
              ? "Includes money you chose to carry from last month"
              : "Money still available this month"
          }
          emphasis
        />
        {weeklyReductionCents > 0 ? (
          <BudgetLine
            label="Weekly guide reduction"
            value={weeklyReductionCents}
            currency={currency}
            hint="From covering overspend — does not change monthly income"
            prefix="−"
          />
        ) : null}
        {weeklySafeToSpendCents > 0 && plan.weeksRemainingInMonth > 0 ? (
          <BudgetLine
            label="Weekly pace"
            value={weeklySafeToSpendCents}
            currency={currency}
            hint={`Per week for the next ${plan.weeksRemainingInMonth} week${plan.weeksRemainingInMonth === 1 ? "" : "s"} — remaining spread evenly${weeklyReductionCents > 0 ? ", minus your overspend adjustment" : ""}`}
          />
        ) : adjustedSafeToSpendCents <= 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Nothing left at an easy weekly pace — review savings, bills, or spending above.
          </p>
        ) : null}
      </FlowSection>
    </div>
  );
}
