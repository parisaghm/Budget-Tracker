import { parseISO } from "date-fns";
import { Pencil } from "lucide-react";
import { HeroMoney } from "@/components/budget/HeroMoney";
import { PlanSegmentBar, PlanStatTile } from "@/components/budget/PlanHeroSegments";
import type { IncomeCycle } from "@/types/incomeCycle";
import { cn } from "@/lib/utils";
import { getNextSalaryDateForMonth } from "@/utils/budgetPlanner";
import {
  formatIncomeDateLabel,
  getCycleWindowDatesForMonthKey,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import {
  calculateSpentPercentage,
  formatMoney,
  formatMoneyCompact,
  formatMonthNameOnly,
} from "@/utils/money";

export interface BudgetHeroCardProps {
  currentMonth: string;
  currency: string;
  incomeCents: number;
  billsCents: number;
  goalsCents: number;
  spentCents: number;
  remainingAllocationCents: number;
  recurringBillsCount?: number;
  weeklySafeToSpendCents?: number;
  incomeCycle?: IncomeCycle | null;
  onAdjust?: () => void;
}

export function BudgetHeroCard({
  currentMonth,
  currency,
  incomeCents,
  billsCents,
  goalsCents,
  spentCents,
  remainingAllocationCents,
  recurringBillsCount = 0,
  weeklySafeToSpendCents = 0,
  incomeCycle = null,
  onAdjust,
}: BudgetHeroCardProps) {
  const monthLabel = formatMonthNameOnly(currentMonth);
  const monthPlanLabel = `${monthLabel.toUpperCase()} PLAN`;
  const spentPct = calculateSpentPercentage(spentCents, incomeCents);
  const isOver = remainingAllocationCents < 0;
  const remainingDisplayCents = Math.max(0, remainingAllocationCents);
  const committedCents = billsCents + goalsCents + spentCents;
  const safeToSpendDisplayCents = isOver ? 0 : remainingDisplayCents;

  const cycleConfigured = isIncomeCycleConfigured(incomeCycle);
  const nextIncomeDate = cycleConfigured
    ? getCycleWindowDatesForMonthKey(incomeCycle, currentMonth).end
    : parseISO(getNextSalaryDateForMonth(currentMonth, incomeCycle));
  const nextIncomeLabel = formatIncomeDateLabel(nextIncomeDate);

  return (
    <section
      className="card-plan card-plan-hero dashboard-card-hover animate-fade-in w-full rounded-[1.5rem] p-5 max-[640px]:rounded-[1.5rem] max-[640px]:p-5 sm:rounded-[2rem] sm:p-9 min-[641px]:rounded-[1.875rem] min-[641px]:p-7"
      aria-labelledby="budget-hero-heading"
    >
      {/* Mobile layout — max 640px */}
      <div className="budget-hero-mobile max-[640px]:block min-[641px]:hidden">
        <div className="flex items-center justify-between gap-3">
          <p
            id="budget-hero-heading"
            className="budget-hero-mobile__plan-label flex items-center gap-2"
          >
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#6B7F5E]" aria-hidden />
            {monthPlanLabel}
          </p>
          {incomeCents > 0 ? (
            <p className="budget-hero-mobile__income">
              {formatMoneyCompact(incomeCents, currency)} income
            </p>
          ) : null}
        </div>

        {incomeCents <= 0 ? (
          <p className="mt-6 text-sm leading-snug text-muted-foreground">
            Add your monthly income to build your budget allocation for {monthLabel}.
          </p>
        ) : (
          <>
            <p className="budget-hero-mobile__safe-label">Safe to spend</p>
            <div className="mt-1">
              <div className="money-hero text-foreground">
                <HeroMoney cents={safeToSpendDisplayCents} currency={currency} />
              </div>
            </div>
            {isOver ? (
              <p className="budget-hero-mobile__weekly text-[#9C5A56]">
                {formatMoney(Math.abs(remainingAllocationCents), currency)} over your {monthLabel}{" "}
                plan
              </p>
            ) : weeklySafeToSpendCents > 0 ? (
              <p className="budget-hero-mobile__weekly">
                {formatMoney(weeklySafeToSpendCents, currency)} / week — until {nextIncomeLabel}
              </p>
            ) : (
              <p className="budget-hero-mobile__weekly">Until {nextIncomeLabel}</p>
            )}

            <div className="budget-hero-mobile__segment">
              <PlanSegmentBar
                salaryCents={incomeCents}
                fixedBillsCents={billsCents}
                savingsAllocationCents={goalsCents}
                spentSoFarCents={spentCents}
                remainingCents={remainingDisplayCents}
                ariaLabel="Monthly budget allocation across bills, goals, spending, and safe to spend"
                className="segment-bar--plan"
              />
            </div>

            <div className="budget-hero-mobile__stats">
              <PlanStatTile
                label="Bills"
                value={formatMoneyCompact(billsCents, currency)}
                accentClass="bg-[hsl(var(--segment-bills))]"
              />
              <PlanStatTile
                label="Goals"
                value={formatMoneyCompact(goalsCents, currency)}
                accentClass="bg-[hsl(var(--segment-goals))]"
              />
              <PlanStatTile
                label="Spent so far"
                value={formatMoneyCompact(spentCents, currency)}
                accentClass="bg-[hsl(var(--segment-spent))]"
              />
              <PlanStatTile
                label="Safe to spend"
                value={formatMoneyCompact(
                  isOver ? remainingAllocationCents : remainingDisplayCents,
                  currency,
                )}
                accentClass="bg-[hsl(var(--segment-safe))]"
              />
            </div>
          </>
        )}
      </div>

      {/* Desktop / tablet layout — 641px+ */}
      <div className="hidden min-[641px]:block">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <p className="label-caps-hero flex items-center gap-2">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              Monthly budget plan
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{monthLabel}</p>
          </div>
          {onAdjust ? (
            <button
              type="button"
              onClick={onAdjust}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-popover px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
            >
              <Pencil className="h-3 w-3 opacity-70" aria-hidden />
              Adjust income
            </button>
          ) : null}
        </div>

        {incomeCents <= 0 ? (
          <p className="mt-6 text-sm leading-snug text-muted-foreground">
            Add your monthly income to build your budget allocation for {monthLabel}.
          </p>
        ) : (
          <div className="mt-6 sm:mt-7">
            <p className="label-caps text-[10px] tracking-[0.14em] text-muted-foreground">
              Budget allocation
            </p>

            <div className="mt-4">
              <PlanSegmentBar
                salaryCents={incomeCents}
                fixedBillsCents={billsCents}
                savingsAllocationCents={goalsCents}
                spentSoFarCents={spentCents}
                remainingCents={remainingDisplayCents}
                ariaLabel="Monthly budget allocation across bills, goals, spending, and remaining budget"
                className="segment-bar--plan"
              />
            </div>

            <p
              className={cn(
                "mt-4 text-sm leading-relaxed",
                isOver ? "text-[#9C5A56]" : "text-[#746A5D]",
              )}
            >
              {isOver ? (
                <>
                  <span className="money-display-md text-foreground">
                    {formatMoney(Math.abs(remainingAllocationCents), currency)}
                  </span>{" "}
                  over your {monthLabel} plan
                </>
              ) : (
                <>
                  <span className="money-display-md text-foreground">
                    {formatMoney(remainingDisplayCents, currency)}
                  </span>{" "}
                  remaining of{" "}
                  <span className="money-display-md">{formatMoney(incomeCents, currency)}</span>{" "}
                  monthly income
                  {committedCents > 0 ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="money-display-md">
                        {formatMoney(committedCents, currency)}
                      </span>{" "}
                      allocated
                    </>
                  ) : null}
                </>
              )}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
              <PlanStatTile
                label="Income"
                value={formatMoneyCompact(incomeCents, currency)}
                sub="Monthly plan"
                accentClass="bg-primary/80"
              />
              <PlanStatTile
                label="Bills"
                value={formatMoneyCompact(billsCents, currency)}
                sub={recurringBillsCount > 0 ? `${recurringBillsCount} recurring` : "Committed"}
                accentClass="bg-[hsl(var(--segment-bills))]"
              />
              <PlanStatTile
                label="Goals"
                value={formatMoneyCompact(goalsCents, currency)}
                sub="Savings + jars"
                accentClass="bg-[hsl(var(--segment-goals))]"
              />
              <PlanStatTile
                label="Spent"
                value={formatMoneyCompact(spentCents, currency)}
                sub={`${spentPct}% of income`}
                accentClass="bg-[hsl(var(--segment-spent))]"
              />
              <PlanStatTile
                label="Remaining"
                value={formatMoneyCompact(
                  isOver ? remainingAllocationCents : remainingDisplayCents,
                  currency,
                )}
                sub={isOver ? "Over plan" : "Unallocated"}
                accentClass="bg-[hsl(var(--segment-safe))]"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
