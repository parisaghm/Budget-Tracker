import { useMemo, type CSSProperties } from "react";
import { Leaf } from "lucide-react";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import type { Expense } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { buildWeekPaceData } from "@/utils/weekPace";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
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

  const prefersReducedMotion = usePrefersReducedMotion();
  const positiveInsight = !isOverTypical && insightLine.includes("less than your usual");

  return (
    <section
      className={cn(
        "week-pace-mobile card-dashboard dashboard-card-hover w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-8",
        calmMode && "opacity-[0.98]",
      )}
      aria-label="Your week so far"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-foreground sm:text-[1.125rem]">
            Your week so far
          </h2>
          {paceLabel ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-sm">{paceLabel}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Spent
          </p>
          <p className="money-display-md mt-1 text-[1.25rem] leading-none text-foreground sm:mt-1.5 sm:text-[1.45rem]">
            <AnimatedMoney
              cents={spentThisWeekCents}
              currency={currency}
              variant="inline"
              animateOnMount
              duration={600}
            />
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1.5 sm:mt-8 sm:gap-2.5">
        {days.map((day, index) => {
          const amount = day.amountCents;
          const heightPct =
            amount > 0 ? Math.max(14, Math.round((amount / maxDayCents) * 100)) : 0;
          const hasAmount = amount > 0;
          const barDelayMs = index * 45;
          const mobileDayLabel = day.dayLabel.charAt(0).toUpperCase();

          return (
            <div key={day.dateIso} className="flex min-w-0 flex-col items-center gap-1.5 sm:gap-2">
              <p
                className={cn(
                  "money-amount-sm hidden h-4 text-[10px] leading-none sm:block sm:text-[11px]",
                  day.isToday ? "text-primary" : "text-foreground/80",
                )}
              >
                {hasAmount ? formatMoney(amount, currency) : ""}
              </p>
              <div className="week-pace-bar-track relative w-full overflow-hidden rounded-2xl sm:h-[7.5rem]">
                {hasAmount ? (
                  <div
                    className={cn(
                      "week-pace-bar-spent absolute inset-x-0 bottom-0 rounded-2xl",
                      !prefersReducedMotion && "week-pace-bar-spent--animate",
                      day.isToday && "ring-1 ring-primary/25",
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
                  day.isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="sm:hidden">{mobileDayLabel}</span>
                <span className="hidden sm:inline">{day.dayLabel}</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="week-pace-feedback mt-5 sm:mt-6">
        <Leaf
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            positiveInsight ? "text-success" : "text-primary/70",
          )}
          aria-hidden
        />
        <p className={cn("text-sm leading-relaxed", positiveInsight ? "text-foreground" : "text-muted-foreground")}>
          {insightLine}
          {positiveInsight ? " Keep it up!" : null}
        </p>
      </div>
    </section>
  );
}
