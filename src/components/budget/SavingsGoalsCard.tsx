import { Link } from "react-router-dom";
import { Plus, Target, Umbrella, Plane, Bike } from "lucide-react";
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
}

export function SavingsGoalsCard({
  goals,
  savingsAllocationCents,
  currency = "EUR",
}: SavingsGoalsCardProps) {
  return (
    <section className="card-elevated p-5 sm:p-6" aria-labelledby="savings-goals-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="savings-goals-heading"
            className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
          >
            Savings &amp; goals
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {savingsAllocationCents > 0
              ? `${formatMoney(savingsAllocationCents, currency)} set aside this month`
              : "Track progress toward your targets"}
          </p>
        </div>
        <Link
          to="/goals"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Goal
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No savings goals yet</p>
          <Link to="/goals" className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
            Add your first goal
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3" role="list">
          {goals.map((goal, index) => {
            const progressPercent =
              goal.targetCents > 0
                ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100))
                : 0;
            const Icon = GOAL_ICONS[index % GOAL_ICONS.length];

            return (
              <li
                key={goal.id}
                className="rounded-2xl border border-border/50 bg-card px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: GOAL_BG[index % GOAL_BG.length] }}
                  >
                    <Icon className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-foreground">{goal.name}</p>
                      <p className="money-display shrink-0 text-sm sm:text-base">
                        {formatMoney(goal.savedCents, currency)}
                        <span className="text-muted-foreground">
                          {" "}
                          / {formatMoney(goal.targetCents, currency)}
                        </span>
                      </p>
                    </div>
                    <div className="mt-2.5 progress-track h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${progressPercent}%`,
                          background: "hsl(var(--segment-bills))",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
