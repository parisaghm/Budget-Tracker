import { useMemo, useState } from "react";
import type { SavingsGoal } from "@/types/finance";
import {
  ADJUSTMENTS_STORAGE_KEY,
  applyBudgetPlanChange,
  getMonthAdjustments,
  setMonthAdjustments,
} from "@/utils/budgetDecisions";
import { calculateGoalPlan } from "@/utils/goalPlan";
import { eurosToCents, formatMoney, getCurrencySymbol } from "@/utils/money";
import {
  computeRecommendedDailyPaceCents,
  getMovableGoalSources,
  type MovableGoalSource,
} from "@/utils/paceSupport";
import { showBudgetUpdatedToast } from "@/utils/budgetActionToast";

const DEBUG_PREFIX = "[NextStep pace]";

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

function monthStorageKey(userId: string, month: string): string {
  return `${userId}:${month}`;
}

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
  const [selectedSavingsGoalId, setSelectedSavingsGoalId] = useState("");

  const adjustments = getMonthAdjustments(userId, month);
  const pausedSet = useMemo(() => new Set(adjustments.pausedGoalIds), [adjustments.pausedGoalIds]);

  const movableGoals = useMemo(
    (): MovableGoalSource[] =>
      getMovableGoalSources(goals, adjustments.pausedGoalIds, adjustments.goalReallocationCents),
    [adjustments.goalReallocationCents, adjustments.pausedGoalIds, goals],
  );

  const pausableGoals = useMemo(
    () =>
      goals.filter((goal) => {
        if (pausedSet.has(goal.id)) return false;
        return calculateGoalPlan(goal).monthlyRequiredSavingCents > 0;
      }),
    [goals, pausedSet],
  );

  const selectedMovableGoal = movableGoals.find((s) => s.goal.id === selectedSavingsGoalId);
  const maxMoveCents = selectedMovableGoal?.availableCents ?? 0;

  const recommendedDailyCents = computeRecommendedDailyPaceCents(
    leftUntilPaydayCents,
    daysToSalary,
  );

  const logDebug = (payload: Record<string, unknown>) => {
    console.debug(DEBUG_PREFIX, payload);
  };

  const openMoveSavings = () => {
    logDebug({ action: "move_from_savings_clicked" });
    if (movableGoals.length === 0) return;
    setSavingsAmount("");
    setSelectedSavingsGoalId(movableGoals[0]?.goal.id ?? "");
    setPending({ kind: "move_savings" });
  };

  const openPauseGoal = () => {
    logDebug({ action: "pause_goal_clicked" });
    if (pausableGoals.length === 0) return;
    setSelectedGoalId(pausableGoals[0]?.id ?? "");
    setPending({ kind: "pause_goal" });
  };

  const openReducePace = () => {
    logDebug({ action: "reduce_daily_pace_clicked" });
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
    const source = movableGoals.find((s) => s.goal.id === selectedSavingsGoalId);
    if (!source) return;

    const value = parseFloat(savingsAmount);
    if (isNaN(value) || value <= 0) return;

    const amountCents = eurosToCents(value);
    if (amountCents > source.availableCents) return;

    const prev = getMonthAdjustments(userId, month);
    const before = leftUntilPaydayCents;
    const after = before + amountCents;
    const storageKey = `${ADJUSTMENTS_STORAGE_KEY} → ${monthStorageKey(userId, month)}.goalReallocationCents.${source.goal.id}`;

    logDebug({
      action: "move_from_savings_confirm",
      selectedGoal: source.goal.name,
      selectedGoalId: source.goal.id,
      amountMovedCents: amountCents,
      previousSafeToSpend: before,
      newSafeToSpend: after,
      storageKey,
    });

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_move_from_savings",
          label: `Move from savings: ${source.goal.name}`,
          amountCents,
          oldValueCents: before,
          newValueCents: after,
        },
        () => {
          const prevRealloc = prev.goalReallocationCents[source.goal.id] ?? 0;
          setMonthAdjustments(userId, month, {
            goalReallocationCents: {
              ...prev.goalReallocationCents,
              [source.goal.id]: prevRealloc + amountCents,
            },
          });
        },
      );
      showBudgetUpdatedToast(
        userId,
        month,
        `Moved ${formatMoney(amountCents, currency)} from "${source.goal.name}" back into this cycle.`,
        onDecided,
      );
      onDecided();
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

    const before = leftUntilPaydayCents;
    const after = before + freedCents;
    const storageKey = `${ADJUSTMENTS_STORAGE_KEY} → ${monthStorageKey(userId, month)}.pausedGoalIds`;

    logDebug({
      action: "pause_goal_confirm",
      selectedGoal: goal.name,
      selectedGoalId: goal.id,
      amountMovedCents: freedCents,
      previousSafeToSpend: before,
      newSafeToSpend: after,
      storageKey,
    });

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_pause_goal",
          label: `Pause goal: ${goal.name}`,
          amountCents: freedCents,
          oldValueCents: before,
          newValueCents: after,
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
      onDecided();
      setPending(null);
    } finally {
      setIsSaving(false);
    }
  };

  const applyReducePace = async () => {
    const prev = getMonthAdjustments(userId, month);
    const before = prev.dailyPaceTargetCents ?? currentDailyPaceCents;
    const storageKey = `${ADJUSTMENTS_STORAGE_KEY} → ${monthStorageKey(userId, month)}.dailyPaceTargetCents`;

    logDebug({
      action: "reduce_daily_pace_confirm",
      previousSafeToSpend: leftUntilPaydayCents,
      newSafeToSpend: leftUntilPaydayCents,
      previousDailyPace: before,
      newDailyPace: recommendedDailyCents,
      storageKey,
    });

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
      onDecided();
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

  const savingsAmountError =
    savingsAmountCents > 0 && maxMoveCents > 0 && savingsAmountCents > maxMoveCents
      ? `Maximum available from this goal: ${formatMoney(maxMoveCents, currency)}`
      : savingsAmountCents > 0 && maxMoveCents <= 0
        ? "No allocation left to move from this goal"
        : null;

  const canConfirmMoveSavings =
    savingsAmountCents > 0 &&
    savingsAmountCents <= maxMoveCents &&
    !!selectedSavingsGoalId;

  return {
    isSaving,
    pending,
    setPending,
    savingsAmount,
    setSavingsAmount,
    savingsAmountCents,
    savingsAmountError,
    canConfirmMoveSavings,
    selectedGoalId,
    setSelectedGoalId,
    selectedSavingsGoalId,
    setSelectedSavingsGoalId,
    movableGoals,
    pausableGoals,
    maxMoveCents,
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
