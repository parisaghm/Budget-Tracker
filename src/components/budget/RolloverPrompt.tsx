import { Link } from "react-router-dom";
import type { SavingsGoal } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { useRolloverDecision } from "@/hooks/useRolloverDecision";
import type { RolloverChoice } from "@/utils/budgetDecisions";
import { BudgetActionConfirmDialog } from "@/components/budget/BudgetActionConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RolloverPromptProps {
  userId: string;
  month: string;
  leftoverCents: number;
  monthlyIncomeCents: number;
  currency: string;
  goals: SavingsGoal[];
  onContribution: (goalId: string, amountCents: number) => Promise<void> | void;
  onDecided: () => void;
}

const choices: { id: RolloverChoice; label: string; hint: string }[] = [
  {
    id: "add_to_budget",
    label: "Carry into this month",
    hint: "Adds the leftover money to this month's available budget.",
  },
  {
    id: "move_to_savings",
    label: "Move to savings",
    hint: "Moves the leftover money into savings.",
  },
  {
    id: "add_to_goal",
    label: "Add to a goal",
    hint: "Use the leftover money for one of your savings goals.",
  },
  {
    id: "ignore",
    label: "Decide later",
    hint: "You can choose what to do with it anytime on this page.",
  },
];

export function RolloverPrompt({
  userId,
  month,
  leftoverCents,
  monthlyIncomeCents,
  currency,
  goals,
  onContribution,
  onDecided,
}: RolloverPromptProps) {
  const {
    activeGoals,
    selectedGoalId,
    setSelectedGoalId,
    isSaving,
    pending,
    setPending,
    requestChoice,
    applyChoice,
    startGoalChoice,
  } = useRolloverDecision({
    userId,
    month,
    leftoverCents,
    monthlyIncomeCents,
    currency,
    goals,
    onContribution,
    onDecided,
  });

  const handleChoice = (id: RolloverChoice) => {
    if (id === "add_to_goal") {
      startGoalChoice();
      return;
    }
    requestChoice(id);
  };

  return (
    <>
      <div className="card-elevated space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Leftover from last month
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            You had {formatMoney(leftoverCents, currency)} left from last month. What do you want to do
            with it? Your monthly income ({formatMoney(monthlyIncomeCents, currency)}) will not change.
          </p>
        </div>

        {activeGoals.length > 1 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Goal for &quot;Add to a goal&quot;</p>
            <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Choose a goal" />
              </SelectTrigger>
              <SelectContent>
                {activeGoals.map((goal) => (
                  <SelectItem key={goal.id} value={goal.id}>
                    {goal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2">
          {choices.map(({ id, label, hint }) => (
            <Button
              key={id}
              type="button"
              variant="secondary"
              disabled={isSaving}
              className="h-auto min-h-12 flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left"
              onClick={() => handleChoice(id)}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs font-normal text-muted-foreground">{hint}</span>
            </Button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Or review your plan on the{" "}
          <Link to="/budget" className="font-semibold text-primary underline-offset-2 hover:underline">
            Budget
          </Link>{" "}
          page.
        </p>
      </div>

      <BudgetActionConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        confirmLabel={pending?.choice === "add_to_budget" ? "Carry into this cycle" : "Apply"}
        isConfirming={isSaving}
        onConfirm={() => pending && void applyChoice(pending.choice)}
      />
    </>
  );
}
