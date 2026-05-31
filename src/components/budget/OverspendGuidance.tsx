import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { BudgetActionConfirmDialog } from "@/components/budget/BudgetActionConfirmDialog";
import { Button } from "@/components/ui/button";

interface OverspendGuidanceProps {
  userId: string;
  month: string;
  overAmountCents: number;
  safeToSpendCents: number;
  monthlyIncomeCents: number;
  previousLeftoverCents: number;
  currency: string;
  onDecided: () => void;
}

const choices: { id: OverspendChoice; label: string; hint: string }[] = [
  {
    id: "reduce_weekly",
    label: "Reduce next week's safe-to-spend",
    hint: "Spreads the gap across the rest of the month",
  },
  {
    id: "use_leftover",
    label: "Use leftover from last month",
    hint: "Only if you still have unallocated leftover",
  },
  {
    id: "move_category",
    label: "Move money from another category",
    hint: "Review spending and adjust on Expenses",
  },
  { id: "ignore", label: "Ignore for now", hint: "No pressure — revisit when you're ready" },
];

interface PendingConfirm {
  choice: OverspendChoice;
  title: string;
  description: string;
}

export function OverspendGuidance({
  userId,
  month,
  overAmountCents,
  safeToSpendCents,
  monthlyIncomeCents,
  previousLeftoverCents,
  currency,
  onDecided,
}: OverspendGuidanceProps) {
  const { incomeCycle } = useIncomeCycle();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const canUseLeftover = previousLeftoverCents > 0;

  const buildConfirm = (choice: OverspendChoice): PendingConfirm | null => {
    const prev = getMonthAdjustments(userId, month);
    const decidedAt = new Date().toISOString();

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
        description: `Add ${formatMoney(cover, currency)} carried from last month (${formatMoney(carriedBefore, currency)} → ${formatMoney(carriedAfter, currency)}). Monthly income stays ${formatMoney(monthlyIncomeCents, currency)} — this only affects money carried forward, not your salary.`,
      };
    }

    if (choice === "ignore") {
      return {
        choice,
        title: "Ignore overspend for now?",
        description:
          "No amounts will change. You can pick another option later or reset this month's plan on the Budget page.",
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
          `Weekly guide: ${formatMoney(weeklyBefore, currency)} → ${formatMoney(weeklyAfter, currency)}. Monthly income unchanged.`,
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
          `Money carried: ${formatMoney(carriedBefore, currency)} → ${formatMoney(carriedAfter, currency)}. Monthly income unchanged.`,
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

  return (
    <>
      <div className="card-elevated space-y-4 border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Over budget
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            You are {formatMoney(overAmountCents, currency)} over budget. How do you want to cover it?
            Your monthly income will not change unless you edit it above.
          </p>
        </div>

        <div className="grid gap-2">
          {choices.map(({ id, label, hint }) => {
            const disabled =
              isSaving || (id === "use_leftover" && !canUseLeftover);
            return (
              <Button
                key={id}
                type="button"
                variant="secondary"
                disabled={disabled}
                className="h-auto min-h-12 flex-col items-start gap-0.5 rounded-2xl px-4 py-3 text-left"
                onClick={() => requestChoice(id)}
              >
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {id === "use_leftover" && !canUseLeftover
                    ? "No leftover available from last month"
                    : hint}
                </span>
              </Button>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          See your full plan on{" "}
          <Link to="/budget" className="font-semibold text-primary underline-offset-2 hover:underline">
            Budget
          </Link>
          .
        </p>
      </div>

      <BudgetActionConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        isConfirming={isSaving}
        onConfirm={() => pending && void applyChoice(pending.choice)}
      />
    </>
  );
}
