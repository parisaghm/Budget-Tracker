import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@/utils/money";
import {
  applyBudgetPlanChange,
  getMonthAdjustments,
  setMonthAdjustments,
  setOverspendDecision,
  type OverspendChoice,
} from "@/utils/budgetDecisions";
import { showBudgetUpdatedToast } from "@/utils/budgetActionToast";
import { useIncomeCycle } from "@/hooks/useIncomeCycle";
import { computeWeeklySafeToSpend, getWeeksRemainingInMonth } from "@/utils/budgetPlanner";

export interface OverspendDecisionContext {
  userId: string;
  month: string;
  overAmountCents: number;
  safeToSpendCents: number;
  monthlyIncomeCents: number;
  previousLeftoverCents: number;
  currency: string;
  onDecided: () => void;
}

interface PendingConfirm {
  choice: OverspendChoice;
  title: string;
  description: string;
}

export const overspendActions = [
  {
    id: "reduce_weekly" as const,
    label: "Reduce daily pace",
    hint: "Spread the gap gently across the rest of the month",
    suggested: true,
  },
  {
    id: "use_leftover" as const,
    label: "Use leftover from last month",
    hint: "Only if you still have unallocated leftover",
    suggested: false,
  },
  {
    id: "move_category" as const,
    label: "Review spending",
    hint: "Adjust categories on Expenses",
    suggested: false,
  },
];

export function useOverspendDecision(context: OverspendDecisionContext) {
  const { incomeCycle } = useIncomeCycle();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const canUseLeftover = context.previousLeftoverCents > 0;

  const buildConfirm = (choice: OverspendChoice): PendingConfirm | null => {
    const { userId, month, overAmountCents, safeToSpendCents, monthlyIncomeCents, previousLeftoverCents, currency } =
      context;
    const prev = getMonthAdjustments(userId, month);

    if (choice === "reduce_weekly") {
      const weeks = getWeeksRemainingInMonth(new Date(), incomeCycle);
      const reduction = Math.round(overAmountCents / weeks);
      const weeklyBefore = Math.max(
        0,
        computeWeeklySafeToSpend(safeToSpendCents, new Date(), incomeCycle) - prev.weeklyReductionCents,
      );
      const weeklyAfter = Math.max(0, weeklyBefore - reduction);
      return {
        choice,
        title: "Reduce weekly safe-to-spend?",
        description: `Reduce next week's safe-to-spend from ${formatMoney(weeklyBefore, currency)} to ${formatMoney(weeklyAfter, currency)}? Your monthly income stays the same — only the weekly guide changes.`,
      };
    }

    if (choice === "use_leftover") {
      const cover = Math.min(previousLeftoverCents, overAmountCents);
      const carriedBefore = prev.rolloverBoostCents;
      const carriedAfter = carriedBefore + cover;
      return {
        choice,
        title: "Use leftover from last month?",
        description: `Add ${formatMoney(cover, currency)} carried from last month (${formatMoney(carriedBefore, currency)} → ${formatMoney(carriedAfter, currency)}).`,
      };
    }

    if (choice === "ignore") {
      return {
        choice,
        title: "Ignore for now?",
        description: "No amounts will change. You can pick another option later.",
      };
    }

    return null;
  };

  const requestChoice = (choice: OverspendChoice) => {
    if (choice === "move_category") {
      navigate("/expenses");
      return;
    }
    const confirm = buildConfirm(choice);
    if (confirm) setPending(confirm);
  };

  const applyChoice = async (choice: OverspendChoice) => {
    const { userId, month, overAmountCents, safeToSpendCents, previousLeftoverCents, currency, onDecided } =
      context;
    setIsSaving(true);
    try {
      const decidedAt = new Date().toISOString();
      const prev = getMonthAdjustments(userId, month);

      if (choice === "reduce_weekly") {
        const weeks = getWeeksRemainingInMonth(new Date(), incomeCycle);
        const reduction = Math.round(overAmountCents / weeks);
        const weeklyBefore = Math.max(
          0,
          computeWeeklySafeToSpend(safeToSpendCents, new Date(), incomeCycle) - prev.weeklyReductionCents,
        );
        const weeklyAfter = Math.max(0, weeklyBefore - reduction);

        applyBudgetPlanChange(
          userId,
          month,
          {
            actionType: "overspend_reduce_weekly",
            label: "Reduce weekly safe-to-spend",
            amountCents: reduction,
            oldValueCents: weeklyBefore,
            newValueCents: weeklyAfter,
          },
          () => {
            setOverspendDecision(userId, month, {
              choice,
              amountCents: overAmountCents,
              decidedAt,
            });
            setMonthAdjustments(userId, month, {
              weeklyReductionCents: prev.weeklyReductionCents + reduction,
            });
          },
        );

        showBudgetUpdatedToast(
          userId,
          month,
          `Weekly guide: ${formatMoney(weeklyBefore, currency)} → ${formatMoney(weeklyAfter, currency)}.`,
          onDecided,
        );
      } else if (choice === "use_leftover") {
        const cover = Math.min(previousLeftoverCents, overAmountCents);
        const carriedBefore = prev.rolloverBoostCents;
        const carriedAfter = carriedBefore + cover;

        applyBudgetPlanChange(
          userId,
          month,
          {
            actionType: "overspend_use_leftover",
            label: "Use leftover from last month",
            amountCents: cover,
            oldValueCents: carriedBefore,
            newValueCents: carriedAfter,
          },
          () => {
            setOverspendDecision(userId, month, {
              choice,
              amountCents: overAmountCents,
              decidedAt,
            });
            setMonthAdjustments(userId, month, {
              leftoverCoverCents: prev.leftoverCoverCents + cover,
              rolloverBoostCents: prev.rolloverBoostCents + cover,
            });
          },
        );

        showBudgetUpdatedToast(
          userId,
          month,
          `Money carried: ${formatMoney(carriedBefore, currency)} → ${formatMoney(carriedAfter, currency)}.`,
          onDecided,
        );
      } else {
        applyBudgetPlanChange(
          userId,
          month,
          {
            actionType: "overspend_ignore",
            label: "Ignore overspend",
          },
          () => {
            setOverspendDecision(userId, month, {
              choice,
              amountCents: overAmountCents,
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
  };

  return {
    isSaving,
    pending,
    setPending,
    canUseLeftover,
    requestChoice,
    applyChoice,
  };
}
