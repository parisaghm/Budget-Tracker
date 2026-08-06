import { useMemo, useState, type CSSProperties } from "react";
import { Wallet } from "lucide-react";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import type { Expense } from "@/types/finance";
import type { IncomeCycle } from "@/types/incomeCycle";
import { formatMoney, getCurrencySymbol } from "@/utils/money";
import {
  buildMonthSpendingTrend,
  type MonthTrendView,
} from "@/utils/monthSpendingTrend";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

interface MonthSpendingTrendCardProps {
  expenses: Expense[];
  currentMonth: string;
  currency?: string;
  incomeCycle?: IncomeCycle | null;
  cycleStartIso?: string | null;
  cycleEndIso?: string | null;
  calmMode?: boolean;
}

function formatAxisLabel(cents: number, currency: string): string {
  const euros = cents / 100;
  if (euros >= 1000) {
    return `${getCurrencySymbol(currency)}${(euros / 1000).toFixed(euros % 1000 === 0 ? 0 : 1)}k`;
  }
  return `${getCurrencySymbol(currency)}${euros % 1 === 0 ? euros.toFixed(0) : euros.toFixed(2)}`;
}

export function MonthSpendingTrendCard({
  expenses,
  currentMonth,
  currency = "EUR",
  incomeCycle = null,
  cycleStartIso = null,
  cycleEndIso = null,
  calmMode = false,
}: MonthSpendingTrendCardProps) {
  const [view, setView] = useState<MonthTrendView>("weekly");
  const prefersReducedMotion = usePrefersReducedMotion();

  const trendData = useMemo(
    () =>
      buildMonthSpendingTrend({
        expenses,
        currentMonth,
        view,
        incomeCycle,
        cycleStartIso,
        cycleEndIso,
      }),
    [expenses, currentMonth, view, incomeCycle, cycleStartIso, cycleEndIso],
  );

  const { buckets, totalSpentCents, cycleLabel, yAxisTicksCents } = trendData;
  const yAxisMaxCents = yAxisTicksCents[yAxisTicksCents.length - 1] ?? 1;
  const hasSpending = totalSpentCents > 0;
  const currencySymbol = getCurrencySymbol(currency);

  const chartSummary = hasSpending
    ? `Spent ${formatMoney(totalSpentCents, currency)} across ${buckets.length} ${view === "weekly" ? "weeks" : "days"} in the ${cycleLabel} window.`
    : `No spending recorded for the ${cycleLabel} window.`;

  return (
    <section
      className={cn(
        "month-trend-card card-dashboard dashboard-card-hover w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-6",
        calmMode && "opacity-[0.98]",
        !hasSpending && "month-trend-card--empty",
      )}
      aria-labelledby="month-spending-trend-heading"
    >
      <div className="month-trend-header">
        <div className="month-trend-header__left">
          <h2
            id="month-spending-trend-heading"
            className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-foreground"
          >
            Monthly spending trend
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cycleLabel}</p>

          {hasSpending ? (
            <div className="month-trend-toggle" role="group" aria-label="Spending trend view">
              {(["weekly", "daily"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={cn(
                    "month-trend-toggle__pill",
                    view === option && "month-trend-toggle__pill--active",
                  )}
                >
                  {option === "weekly" ? "Weekly" : "Daily"}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="month-trend-header__right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Spent
          </p>
          <p className="money-display-md mt-1 text-[1.25rem] leading-none text-foreground sm:text-[1.45rem]">
            <AnimatedMoney
              cents={totalSpentCents}
              currency={currency}
              variant="inline"
              animateOnMount
              duration={600}
            />
          </p>
          <button
            type="button"
            className="month-trend-unit-select"
            aria-label={`Chart unit: amount in ${currency}`}
            disabled
          >
            Amount ({currencySymbol})
          </button>
        </div>
      </div>

      <div className="month-trend-body">
        {!hasSpending ? (
          <div className="month-trend-empty-state">
            <div className="month-trend-empty-illustration">
              <Wallet className="h-7 w-7" aria-hidden />
            </div>
            <p className="text-sm font-medium text-foreground">No spending recorded yet</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Your trend will appear here after the first expense for this cycle.
            </p>
            <p className="mt-3 rounded-full border border-border bg-popover px-3 py-1 text-xs font-medium text-primary">
              Add your first expense to start the chart
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "month-trend-chart",
              view === "daily" && "month-trend-chart--daily",
            )}
            role="img"
            aria-label={chartSummary}
          >
            <p className="sr-only">{chartSummary}</p>

            <div className="month-trend-chart__plot">
              <div className="month-trend-chart__y-axis" aria-hidden>
                {[...yAxisTicksCents].reverse().map((tick) => (
                  <span key={tick} className="month-trend-chart__y-label">
                    {formatAxisLabel(tick, currency)}
                  </span>
                ))}
              </div>

              <div
                className={cn(
                  "month-trend-chart__bars-wrap",
                  view === "daily" && "month-trend-chart__bars-wrap--scroll",
                )}
              >
                <div
                  className="month-trend-chart__grid"
                  style={{ ["--y-ticks" as string]: yAxisTicksCents.length }}
                  aria-hidden
                >
                  {[...yAxisTicksCents].reverse().map((tick) => (
                    <div key={tick} className="month-trend-chart__grid-line" />
                  ))}
                </div>

                <div
                  className="month-trend-chart__bars"
                  style={{
                    ["--bar-count" as string]: buckets.length,
                    gridTemplateColumns:
                      view === "daily"
                        ? `repeat(${buckets.length}, minmax(2.25rem, 1fr))`
                        : `repeat(${buckets.length}, minmax(0, 1fr))`,
                  }}
                >
                  {buckets.map((bucket, index) => {
                    const heightPct =
                      bucket.amountCents > 0
                        ? Math.max(4, Math.round((bucket.amountCents / yAxisMaxCents) * 100))
                        : 0;
                    const barDelayMs = index * 45;

                    return (
                      <div key={bucket.key} className="month-trend-chart__column">
                        <p
                          className={cn(
                            "month-trend-chart__amount",
                            bucket.isCurrent && "month-trend-chart__amount--current",
                          )}
                        >
                          {bucket.amountCents > 0
                            ? formatMoney(bucket.amountCents, currency)
                            : ""}
                        </p>

                        <div className="month-trend-chart__bar-area">
                          {bucket.amountCents > 0 ? (
                            <div
                              className={cn(
                                "month-trend-chart__bar",
                                !prefersReducedMotion && "month-trend-chart__bar--animate",
                                bucket.isCurrent && "month-trend-chart__bar--current",
                              )}
                              style={
                                prefersReducedMotion
                                  ? { height: `${heightPct}%` }
                                  : ({
                                      ["--bar-target-height" as string]: `${heightPct}%`,
                                      ["--bar-delay" as string]: `${barDelayMs}ms`,
                                      ["--bar-duration" as string]: "500ms",
                                    } as CSSProperties)
                              }
                            />
                          ) : null}
                        </div>

                        <div className="month-trend-chart__x-label">
                          <span
                            className={cn(
                              "month-trend-chart__x-primary",
                              bucket.isCurrent && "month-trend-chart__x-primary--current",
                            )}
                          >
                            {bucket.label}
                          </span>
                          {bucket.dateRangeLabel ? (
                            <span className="month-trend-chart__x-range">{bucket.dateRangeLabel}</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
