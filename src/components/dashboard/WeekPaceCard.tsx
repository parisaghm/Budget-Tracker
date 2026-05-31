import { useMemo } from "react";
import { Leaf } from "lucide-react";
import type { Expense } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { buildWeekPaceData } from "@/utils/weekPace";
import { cn } from "@/lib/utils";

interface WeekPaceCardProps {
  expenses: Expense[];
  currentMonth: string;
  currency?: string;
  /** Calmer visuals when finances are tighter. */
  calmMode?: boolean;
}

export function WeekPaceCard({
  expenses,
  currentMonth,
  currency = "EUR",
  calmMode = false,
}: WeekPaceCardProps) {
  const paceData = useMemo(
    () => buildWeekPaceData({ expenses, currentMonth, currency }),
    [expenses, currentMonth, currency],
  );

  const { days, spentThisWeekCents, insightLine, isOverTypical, maxDayCents, paceLabel } =
    paceData;

  const positiveInsight = !isOverTypical && insightLine.includes("less than your usual");

  return (
    <section
      className={cn("card-dashboard p-6 sm:p-8", calmMode && "opacity-[0.98]")}
      aria-label="Your week so far"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#1A1411] sm:text-[1.125rem]">
            Your week so far
          </h2>
          {paceLabel ? (
            <p className="mt-1.5 text-sm leading-relaxed text-[#746A5D]">{paceLabel}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#746A5D]">
            Spent this week
          </p>
          <p className="money-display-md mt-1.5 text-[1.35rem] text-[#1A1411] sm:text-[1.45rem]">
            {formatMoney(spentThisWeekCents, currency)}
          </p>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-7 gap-2 sm:mt-8 sm:gap-2.5">
        {days.map((day) => {
          const amount = day.amountCents;
          const heightPct =
            amount > 0 ? Math.max(14, Math.round((amount / maxDayCents) * 100)) : 0;
          const hasAmount = amount > 0;

          return (
            <div key={day.dateIso} className="flex flex-col items-center gap-2">
              <p
                className={cn(
                  "money-amount-sm h-4 text-[10px] leading-none sm:text-[11px]",
                  day.isToday ? "text-[#6E4E91]" : "text-[#2B221B]/80",
                )}
              >
                {hasAmount ? formatMoney(amount, currency) : ""}
              </p>
              <div
                className="week-pace-bar-track relative w-full overflow-hidden rounded-2xl"
                style={{ height: "7.5rem" }}
              >
                {hasAmount ? (
                  <div
                    className={cn(
                      "week-pace-bar-spent absolute inset-x-0 bottom-0 rounded-2xl transition-all duration-700 ease-out",
                      day.isToday && "ring-1 ring-[#6E4E91]/25",
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                ) : null}
              </div>
              <p
                className={cn(
                  "text-xs font-normal",
                  day.isToday ? "font-medium text-[#6E4E91]" : "text-[#746A5D]",
                )}
              >
                {day.dayLabel}
              </p>
            </div>
          );
        })}
      </div>

      <div className="week-pace-feedback mt-6">
        <Leaf
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            positiveInsight ? "text-[#6B7F5E]" : "text-[#6E4E91]/70",
          )}
          aria-hidden
        />
        <p className={cn(positiveInsight ? "text-[#2B221B]" : "text-[#746A5D]")}>
          {insightLine}
          {positiveInsight ? " Keep it up!" : null}
        </p>
      </div>
    </section>
  );
}
