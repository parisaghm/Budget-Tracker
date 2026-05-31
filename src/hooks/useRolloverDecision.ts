import { useCallback, useState } from "react";
import type { SavingsGoal } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import {
  applyBudgetPlanChange,
  getMonthAdjustments,
  setMonthAdjustments,
  setRolloverDecision,
  type RolloverChoice,
} from "@/utils/budgetDecisions";
import { showBudgetUpdatedToast } from "@/utils/budgetActionToast";
import { toast } from "sonner";

export interface UseRolloverDecisionParams {
  userId: string;
  month: string;
  leftoverCents: number;
  monthlyIncomeCents: number;
  currency: string;
  goals: SavingsGoal[];
  onContribution: (goalId: string, amountCents: number) => Promise<void> | void;
  onDecided: () => void;
}

export interface RolloverConfirmState {
  choice: RolloverChoice;
  title: string;
  description: string;
}

export function useRolloverDecision({
  userId,
  month,
  leftoverCents,
  monthlyIncomeCents,
  currency,
  goals,
  onContribution,
  onDecided,
}: UseRolloverDecisionParams) {
  const [selectedGoalId, setSelectedGoalId] = useState(goals[0]?.id ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<RolloverConfirmState | null>(null);

  const activeGoals = goals.filter((g) => g.savedCents < g.targetCents);

  const buildConfirm = useCallback(
    (choice: RolloverChoice, goalIdOverride?: string): RolloverConfirmState | null => {
      const prev = getMonthAdjustments(userId, month);

      if (choice === "add_to_budget") {
        const carriedBefore = prev.rolloverBoostCents;
        const carriedAfter = carriedBefore + leftoverCents;
        return {
          choice,
          title: "Carry this amount into this cycle?",
          description: `Only confirm if you want ${formatMoney(leftoverCents, currency)} from last month added to what's left this cycle (${formatMoney(carriedBefore, currency)} → ${formatMoney(carriedAfter, currency)}). Your monthly income stays ${formatMoney(monthlyIncomeCents, currency)}.`,
        };
      }

      if (choice === "move_to_savings") {
        return {
          choice,
          title: "Move leftover to savings?",
          description: `Move ${formatMoney(leftoverCents, currency)} into savings. Your monthly income stays ${formatMoney(monthlyIncomeCents, currency)}.`,
        };
      }

      if (choice === "add_to_goal") {
        const goalId = goalIdOverride ?? selectedGoalId;
        const goal = goals.find((g) => g.id === goalId);
        return {
          choice,
          title: "Add leftover to a goal?",
          description: goal
            ? `Add ${formatMoney(leftoverCents, currency)} to "${goal.name}". Your monthly income stays ${formatMoney(monthlyIncomeCents, currency)}.`
            : `Add ${formatMoney(leftoverCents, currency)} to your selected goal. Your monthly income stays ${formatMoney(monthlyIncomeCents, currency)}.`,
        };
      }

      return {
        choice,
        title: "Decide later?",
        description:
          "No amounts will change for now. You can pick what to do with this leftover anytime on the Budget page.",
      };
    },
    [currency, goals, leftoverCents, monthlyIncomeCents, month, selectedGoalId, userId],
  );

  const requestChoice = useCallback(
    (choice: RolloverChoice, goalIdOverride?: string) => {
      const confirm = buildConfirm(choice, goalIdOverride);
      if (confirm) setPending(confirm);
    },
    [buildConfirm],
  );

  const applyChoice = useCallback(
    async (choice: RolloverChoice, goalIdOverride?: string) => {
      setIsSaving(true);
      try {
        const decidedAt = new Date().toISOString();
        const prev = getMonthAdjustments(userId, month);

        if (choice === "add_to_budget") {
          const carriedBefore = prev.rolloverBoostCents;
          const carriedAfter = carriedBefore + leftoverCents;

          applyBudgetPlanChange(
            userId,
            month,
            {
              actionType: "rollover_carry",
              label: "Carry leftover into budget",
              amountCents: leftoverCents,
              oldValueCents: carriedBefore,
              newValueCents: carriedAfter,
            },
            () => {
              setRolloverDecision(userId, month, { choice, amountCents: leftoverCents, decidedAt });
              setMonthAdjustments(userId, month, {
                rolloverBoostCents: prev.rolloverBoostCents + leftoverCents,
              });
            },
          );

          showBudgetUpdatedToast(
            userId,
            month,
            `Added ${formatMoney(leftoverCents, currency)} to this month's budget.`,
            onDecided,
          );
        } else if (choice === "move_to_savings" || choice === "add_to_goal") {
          const goalId =
            choice === "add_to_goal" ? goalIdOverride ?? selectedGoalId : goals[0]?.id;
          if (!goalId) {
            toast.message("No goal yet", {
              description: "Create a savings goal first, or carry the leftover into this month.",
            });
            applyBudgetPlanChange(
              userId,
              month,
              { actionType: "rollover_ignore", label: "Decide later" },
              () => {
                setRolloverDecision(userId, month, {
                  choice: "ignore",
                  amountCents: leftoverCents,
                  decidedAt,
                });
              },
            );
            showBudgetUpdatedToast(userId, month, "Saved for later.", onDecided);
          } else {
            const goal = goals.find((g) => g.id === goalId);
            await Promise.resolve(onContribution(goalId, leftoverCents));

            applyBudgetPlanChange(
              userId,
              month,
              {
                actionType: choice === "add_to_goal" ? "rollover_goal" : "rollover_savings",
                label: choice === "add_to_goal" ? "Add leftover to goal" : "Move leftover to savings",
                amountCents: leftoverCents,
              },
              () => {
                setRolloverDecision(userId, month, {
                  choice,
                  amountCents: leftoverCents,
                  goalId,
                  decidedAt,
                });
              },
            );

            showBudgetUpdatedToast(
              userId,
              month,
              choice === "add_to_goal" && goal
                ? `Added ${formatMoney(leftoverCents, currency)} to ${goal.name}.`
                : `Moved ${formatMoney(leftoverCents, currency)} into savings.`,
              onDecided,
            );
          }
        } else {
          applyBudgetPlanChange(
            userId,
            month,
            { actionType: "rollover_ignore", label: "Decide later" },
            () => {
              setRolloverDecision(userId, month, {
                choice,
                amountCents: leftoverCents,
                decidedAt,
              });
            },
          );
          showBudgetUpdatedToast(userId, month, "Saved for later — no amounts changed.", onDecided);
        }
        setPending(null);
      } finally {
        setIsSaving(false);
      }
    },
    [
      currency,
      goals,
      leftoverCents,
      month,
      onContribution,
      onDecided,
      selectedGoalId,
      userId,
    ],
  );

  const startGoalChoice = useCallback(() => {
    if (activeGoals.length === 0) {
      toast.message("No active goals", {
        description: "Create a savings goal first, or carry the leftover into this month.",
      });
      return;
    }
    if (activeGoals.length === 1) {
      requestChoice("add_to_goal", activeGoals[0].id);
      return;
    }
    const goalId = selectedGoalId || activeGoals[0]?.id;
    if (goalId) {
      requestChoice("add_to_goal", goalId);
    }
  }, [activeGoals, requestChoice, selectedGoalId]);

  return {
    activeGoals,
    selectedGoalId,
    setSelectedGoalId,
    isSaving,
    pending,
    setPending,
    requestChoice,
    applyChoice,
    startGoalChoice,
  };
}
