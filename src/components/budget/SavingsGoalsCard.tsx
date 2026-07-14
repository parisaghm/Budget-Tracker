import { Link } from "react-router-dom";
import { ArrowRight, Plus, Target, Umbrella, Plane, Bike } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SavingsGoal } from "@/types/finance";
import { formatMoney } from "@/utils/money";

const GOAL_ICONS: LucideIcon[] = [Umbrella, Plane, Bike, Target];

const GOAL_BG = [
  "hsl(278 24% 38% / 0.1)",
  "hsl(32 42% 58% / 0.14)",
  "hsl(152 28% 38% / 0.12)",
  "hsl(278 16% 72% / 0.2)",
];

export interface SavingsGoalsCardProps {
  goals: SavingsGoal[];
  savingsAllocationCents: number;
  currency?: string;
  /** Max goals shown before "View all" link. */
  maxVisible?: number;
}

export function SavingsGoalsCard({
  goals,
  savingsAllocationCents,
  currency = "EUR",
  maxVisible = 4,
}: SavingsGoalsCardProps) {
  const visibleGoals = goals.slice(0, maxVisible);
  const hasMore = goals.length > maxVisible;

  return (
    <section
      className="savings-goals-card--mobile card-dashboard dashboard-card-hover rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-8"
      aria-labelledby="savings-goals-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="savings-goals-heading" className="heading-card">
          Savings &amp; goals
        </h2>
        <Link
          to="/goals"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Goal
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No savings goals yet</p>
          <Link to="/goals" className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
            Add your first goal
          </Link>
        </div>
      ) : (
        <>
          {savingsAllocationCents > 0 ? (
            <p className="mt-1 hidden text-sm text-muted-foreground min-[641px]:block">
              {formatMoney(savingsAllocationCents, currency)} set aside this month
            </p>
          ) : null}

          <ul className="mt-4 flex flex-col space-y-3" role="list">
            {visibleGoals.map((goal, index) => {
              const progressPercent =
                goal.targetCents > 0
                  ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100))
                  : 0;
              const Icon = GOAL_ICONS[index % GOAL_ICONS.length];

              return (
                <li key={goal.id}>
                  <div className="bill-row-lifted flex items-start gap-3 p-3 sm:p-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: GOAL_BG[index % GOAL_BG.length] }}
                    >
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                        <p className="money-display shrink-0 text-sm sm:text-base">
                          {formatMoney(goal.savedCents, currency)}
                          <span className="text-muted-foreground">
                            {" "}
                            / {formatMoney(goal.targetCents, currency)}
                          </span>
                        </p>
                      </div>
                      <div className="mt-2 progress-track h-2">
                        <div
                          className="progress-bar h-2"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {progressPercent}% complete
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore || goals.length > 0 ? (
            <Link
              to="/goals"
              className="mt-3 hidden items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80 min-[641px]:inline-flex"
            >
              View all goals
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
