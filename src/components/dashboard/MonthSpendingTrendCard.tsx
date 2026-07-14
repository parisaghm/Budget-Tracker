import { useMemo, useState, type CSSProperties } from "react";
import { Wallet } from "lucide-react";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import type { Expense } from "@/types/finance";
import { formatMoney } from "@/utils/money";
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
  calmMode?: boolean;
}

export function MonthSpendingTrendCard({
  expenses,
  currentMonth,
  currency = "EUR",
  calmMode = false,
}: MonthSpendingTrendCardProps) {
  const [view, setView] = useState<MonthTrendView>("weekly");
  const prefersReducedMotion = usePrefersReducedMotion();

  const trendData = useMemo(
    () => buildMonthSpendingTrend({ expenses, currentMonth, view }),
    [expenses, currentMonth, view],
  );

  const { buckets, totalSpentCents, monthLabel, maxBucketCents } = trendData;
  const columnCount = buckets.length;
  const hasSpending = totalSpentCents > 0;

  return (
    <section
      className={cn(
        "month-trend-card week-pace-mobile card-dashboard dashboard-card-hover w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-6",
        calmMode && "opacity-[0.98]",
        !hasSpending && "month-trend-card--empty",
      )}
      aria-labelledby="month-spending-trend-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="month-spending-trend-heading"
            className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-[#1A1411]"
          >
            Monthly spending trend
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#746A5D]">
            {monthLabel} · month to date
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#746A5D]">
            Spent
          </p>
          <p className="money-display-md mt-1 text-[1.25rem] leading-none text-[#1A1411] sm:text-[1.45rem]">
            <AnimatedMoney
              cents={totalSpentCents}
              currency={currency}
              variant="inline"
              animateOnMount
              duration={600}
            />
          </p>
        </div>
      </div>

      {hasSpending ? (
        <div className="mt-3 flex gap-2">
          {(["weekly", "daily"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                view === option
                  ? "border-[#6E4E91]/30 bg-[#EFE7F7] text-[#4A3463]"
                  : "border-[#E8DFCC] bg-transparent text-[#746A5D] hover:bg-[#FFFDF8]",
              )}
            >
              {option === "weekly" ? "Weekly" : "Daily"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="month-trend-body">
        {!hasSpending ? (
          <div className="month-trend-empty-state">
            <div className="month-trend-empty-illustration">
              <Wallet className="h-7 w-7" aria-hidden />
            </div>
            <p className="text-sm font-medium text-[#2B221B]">No spending recorded yet</p>
            <p className="mt-1 text-sm leading-relaxed text-[#746A5D]">
              Your trend will appear here after the first expense for this month.
            </p>
            <p className="mt-3 rounded-full border border-[#E8DFCC] bg-[#FFFDF8] px-3 py-1 text-xs font-medium text-[#6E4E91]">
              Add your first expense to start the chart
            </p>
          </div>
        ) : (
          <div className="month-trend-chart-area">
            <div
              className="grid gap-1.5 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
            >
              {buckets.map((bucket, index) => {
                const heightPct = Math.max(
                  14,
                  Math.round((bucket.amountCents / maxBucketCents) * 100),
                );
                const barDelayMs = index * 45;

                return (
                  <div
                    key={bucket.key}
                    className="flex min-w-0 flex-col items-center gap-1.5 sm:gap-2"
                  >
                    <p
                      className={cn(
                        "money-amount-sm hidden h-4 text-[10px] leading-none sm:block sm:text-[11px]",
                        bucket.isCurrent ? "text-[#6E4E91]" : "text-[#2B221B]/80",
                      )}
                    >
                      {bucket.amountCents > 0 ? formatMoney(bucket.amountCents, currency) : ""}
                    </p>
                    <div className="week-pace-bar-track relative w-full overflow-hidden rounded-2xl sm:h-[5.5rem]">
                      {bucket.amountCents > 0 ? (
                        <div
                          className={cn(
                            "week-pace-bar-spent absolute inset-x-0 bottom-0 rounded-2xl",
                            !prefersReducedMotion && "week-pace-bar-spent--animate",
                            bucket.isCurrent && "ring-1 ring-[#6E4E91]/25",
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
                    <p
                      className={cn(
                        "week-pace-day-label text-[11px] font-medium sm:text-xs sm:font-normal",
                        bucket.isCurrent ? "text-[#6E4E91]" : "text-[#746A5D]",
                      )}
                    >
                      {bucket.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
