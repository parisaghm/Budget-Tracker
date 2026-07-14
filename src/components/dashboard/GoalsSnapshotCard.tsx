import { Link } from "react-router-dom";
import { ArrowRight, Target, Umbrella, Plane, Bike } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SavingsGoal } from "@/types/finance";
import { Button } from "@/components/ui/button";

const GOAL_ICONS: LucideIcon[] = [Umbrella, Plane, Bike, Target];

const GOAL_BG = [
  "hsl(278 24% 38% / 0.1)",
  "hsl(32 42% 58% / 0.14)",
  "hsl(152 28% 38% / 0.12)",
  "hsl(278 16% 72% / 0.2)",
];

export interface GoalsSnapshotCardProps {
  goals: SavingsGoal[];
  maxVisible?: number;
}

export function GoalsSnapshotCard({ goals, maxVisible = 3 }: GoalsSnapshotCardProps) {
  const visibleGoals = goals.slice(0, maxVisible);
  const hasMeaningfulGoals = goals.some(
    (goal) => goal.targetCents > 0 || goal.savedCents > 0,
  );

  return (
    <section
      className="card-dashboard dashboard-card-hover dashboard-card-fill w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-6"
      aria-labelledby="goals-snapshot-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="goals-snapshot-heading" className="heading-card">
            Goals snapshot
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Progress on your savings goals</p>
        </div>
        <Link
          to="/goals"
          className="touch-hit shrink-0 text-sm font-medium text-[#6E4E91] transition-colors hover:text-[#4A3463]"
        >
          View all goals →
        </Link>
      </div>

      {hasMeaningfulGoals ? (
        <ul className="mt-4 space-y-3" role="list">
          {visibleGoals.map((goal, index) => {
            const progressPercent =
              goal.targetCents > 0
                ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100))
                : 0;
            const Icon = GOAL_ICONS[index % GOAL_ICONS.length];

            return (
              <li key={goal.id}>
                <div className="bill-row-lifted flex items-center gap-3 p-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: GOAL_BG[index % GOAL_BG.length] }}
                  >
                    <Icon className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{goal.name}</p>
                      <p className="money-display shrink-0 text-sm font-semibold">
                        {progressPercent}%
                      </p>
                    </div>
                    <div className="mt-2 progress-track h-2">
                      <div className="progress-bar h-2" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="dashboard-empty-state">
          <div
            className="dashboard-empty-icon"
            style={{ backgroundColor: "hsl(278 24% 38% / 0.1)" }}
          >
            <Target className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            No active goals yet. Create a goal to start tracking your progress.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-4 rounded-full border-[#E8DFCC] bg-[#FFFDF8] text-[#2B221B] hover:bg-[#EFE7F7] hover:text-[#4A3463]"
          >
            <Link to="/goals">Create goal</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
