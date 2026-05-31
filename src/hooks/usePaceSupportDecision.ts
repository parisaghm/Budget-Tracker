import { useMemo, useState } from "react";
import type { SavingsGoal } from "@/types/finance";
import {
  applyBudgetPlanChange,
  getMonthAdjustments,
  setMonthAdjustments,
} from "@/utils/budgetDecisions";
import { calculateGoalPlan } from "@/utils/goalPlan";
import { eurosToCents, formatMoney, getCurrencySymbol } from "@/utils/money";
import { computeRecommendedDailyPaceCents } from "@/utils/paceSupport";
import { showBudgetUpdatedToast } from "@/utils/budgetActionToast";

export interface PaceSupportDecisionContext {
  userId: string;
  month: string;
  currency: string;
  leftUntilPaydayCents: number;
  daysToSalary: number;
  currentDailyPaceCents: number;
  goals: SavingsGoal[];
  onDecided: () => void;
}

type PendingModal =
  | { kind: "move_savings" }
  | { kind: "pause_goal" }
  | { kind: "reduce_pace"; title: string; description: string };

export function usePaceSupportDecision(context: PaceSupportDecisionContext) {
  const {
    userId,
    month,
    currency,
    leftUntilPaydayCents,
    daysToSalary,
    currentDailyPaceCents,
    goals,
    onDecided,
  } = context;

  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<PendingModal | null>(null);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");

  const adjustments = getMonthAdjustments(userId, month);
  const pausedSet = useMemo(() => new Set(adjustments.pausedGoalIds), [adjustments.pausedGoalIds]);

  const pausableGoals = useMemo(
    () =>
      goals.filter((goal) => {
        if (pausedSet.has(goal.id)) return false;
        return calculateGoalPlan(goal).monthlyRequiredSavingCents > 0;
      }),
    [goals, pausedSet],
  );

  const recommendedDailyCents = computeRecommendedDailyPaceCents(
    leftUntilPaydayCents,
    daysToSalary,
  );

  const openMoveSavings = () => {
    setSavingsAmount("");
    setPending({ kind: "move_savings" });
  };

  const openPauseGoal = () => {
    if (pausableGoals.length === 0) return;
    setSelectedGoalId(pausableGoals[0]?.id ?? "");
    setPending({ kind: "pause_goal" });
  };

  const openReducePace = () => {
    const currentPace = adjustments.dailyPaceTargetCents ?? currentDailyPaceCents;
    setPending({
      kind: "reduce_pace",
      title: "Reduce daily pace?",
      description:
        daysToSalary > 0
          ? `${formatMoney(leftUntilPaydayCents, currency)} left in this cycle ÷ ${daysToSalary} day${daysToSalary === 1 ? "" : "s"} = ${formatMoney(recommendedDailyCents, currency)} per day. Update your daily pace target from ${formatMoney(currentPace, currency)} to ${formatMoney(recommendedDailyCents, currency)}?`
          : `Set your daily pace target to ${formatMoney(recommendedDailyCents, currency)} per day.`,
    });
  };

  const applyMoveSavings = async () => {
    const value = parseFloat(savingsAmount);
    if (isNaN(value) || value <= 0) return;

    const amountCents = eurosToCents(value);
    const prev = getMonthAdjustments(userId, month);
    const before = leftUntilPaydayCents;
    const after = before + amountCents;

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_move_from_savings",
          label: "Move money from savings",
          amountCents,
          oldValueCents: before,
          newValueCents: after,
        },
        () => {
          setMonthAdjustments(userId, month, {
            rolloverBoostCents: prev.rolloverBoostCents + amountCents,
          });
        },
      );
      showBudgetUpdatedToast(
        userId,
        month,
        `Added ${formatMoney(amountCents, currency)} to what's left in this cycle.`,
        onDecided,
      );
      setPending(null);
    } finally {
      setIsSaving(false);
    }
  };

  const applyPauseGoal = async () => {
    const goal = pausableGoals.find((g) => g.id === selectedGoalId);
    if (!goal) return;

    const freedCents = calculateGoalPlan(goal).monthlyRequiredSavingCents;
    const prev = getMonthAdjustments(userId, month);
    if (prev.pausedGoalIds.includes(goal.id)) return;

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_pause_goal",
          label: `Pause goal: ${goal.name}`,
          amountCents: freedCents,
        },
        () => {
          setMonthAdjustments(userId, month, {
            pausedGoalIds: [...prev.pausedGoalIds, goal.id],
          });
        },
      );
      showBudgetUpdatedToast(
        userId,
        month,
        `Paused "${goal.name}" this month — ${formatMoney(freedCents, currency)} returned to your spending room.`,
        onDecided,
      );
      setPending(null);
    } finally {
      setIsSaving(false);
    }
  };

  const applyReducePace = async () => {
    const prev = getMonthAdjustments(userId, month);
    const before = prev.dailyPaceTargetCents ?? currentDailyPaceCents;

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_reduce_daily_pace",
          label: "Reduce daily pace",
          oldValueCents: before,
          newValueCents: recommendedDailyCents,
        },
        () => {
          setMonthAdjustments(userId, month, {
            dailyPaceTargetCents: recommendedDailyCents,
          });
        },
      );
      showBudgetUpdatedToast(
        userId,
        month,
        `Daily pace: ${formatMoney(before, currency)} → ${formatMoney(recommendedDailyCents, currency)} per day.`,
        onDecided,
      );
      setPending(null);
    } finally {
      setIsSaving(false);
    }
  };

  const savingsAmountCents = (() => {
    const value = parseFloat(savingsAmount);
    if (isNaN(value) || value <= 0) return 0;
    return eurosToCents(value);
  })();

  return {
    isSaving,
    pending,
    setPending,
    savingsAmount,
    setSavingsAmount,
    savingsAmountCents,
    selectedGoalId,
    setSelectedGoalId,
    pausableGoals,
    recommendedDailyCents,
    currencySymbol: getCurrencySymbol(currency),
    openMoveSavings,
    openPauseGoal,
    openReducePace,
    applyMoveSavings,
    applyPauseGoal,
    applyReducePace,
  };
}
