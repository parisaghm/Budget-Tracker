import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { SavingsGoal } from "@/types/finance";
import type { IncomeCycle } from "@/types/incomeCycle";
import {
  computeActiveSavingsContributionCents,
  computeDeficitCents,
  distributeSavingsReductionAcrossGoals,
  projectAfterSavingsReduction,
} from "@/utils/adjustSavings";
import {
  applyBudgetPlanChange,
  getMonthAdjustments,
  setMonthAdjustments,
} from "@/utils/budgetDecisions";
import { persistMonthAdjustmentsToSupabase } from "@/utils/budgetAdjustmentsPersistence";
import {
  getCycleWindowDatesForMonthKey,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { eurosToCents, formatMoney } from "@/utils/money";
import { getMovableGoalSources } from "@/utils/paceSupport";
import { supabase } from "@/lib/supabase/client";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";

export interface AdjustSavingsDecisionContext {
  userId: string;
  month: string;
  currency: string;
  safeToSpendCents: number;
  savingsAllocationCents: number;
  pausedGoalsBoostCents: number;
  goalReallocationBoostCents: number;
  goals: SavingsGoal[];
  incomeCycle: IncomeCycle | null;
  /** Frozen cycle window (half-open) from budget_cycles when available. */
  cycleStartIso?: string | null;
  cycleEndIso?: string | null;
  isDemoMode?: boolean;
  onDecided: () => void;
  onTransferBack: (goalId: string, amountCents: number) => Promise<void>;
}

function resolveCycleWindowIso(
  month: string,
  incomeCycle: IncomeCycle | null,
  cycleStartIso?: string | null,
  cycleEndIso?: string | null,
): { startIso: string; endIso: string } {
  if (cycleStartIso && cycleEndIso) {
    return { startIso: cycleStartIso, endIso: cycleEndIso };
  }
  if (isIncomeCycleConfigured(incomeCycle)) {
    const { start, end } = getCycleWindowDatesForMonthKey(incomeCycle, month);
    return {
      startIso: format(start, "yyyy-MM-dd"),
      endIso: format(end, "yyyy-MM-dd"),
    };
  }
  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  return {
    startIso: format(monthStart, "yyyy-MM-dd"),
    endIso: format(monthEnd, "yyyy-MM-dd"),
  };
}

async function fetchCycleContributionsByGoal(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("goal_id, amount_cents, created_at")
    .eq("user_id", userId)
    .gte("created_at", `${startIso}T00:00:00`)
    .lte("created_at", `${endIso}T23:59:59`);

  if (error || !data) return {};

  return data.reduce<Record<string, number>>((acc, row) => {
    const goalId = row.goal_id as string;
    const amount = Number(row.amount_cents) || 0;
    if (amount > 0) {
      acc[goalId] = (acc[goalId] ?? 0) + amount;
    }
    return acc;
  }, {});
}

export function useAdjustSavingsDecision(context: AdjustSavingsDecisionContext) {
  const {
    userId,
    month,
    currency,
    safeToSpendCents,
    savingsAllocationCents,
    pausedGoalsBoostCents,
    goalReallocationBoostCents,
    goals,
    incomeCycle,
    cycleStartIso = null,
    cycleEndIso = null,
    isDemoMode = false,
    onDecided,
    onTransferBack,
  } = context;

  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reductionInput, setReductionInput] = useState("");
  const [selectedQuickOption, setSelectedQuickOption] = useState<"deficit" | "buffer50" | "buffer100">(
    "deficit",
  );
  const [cycleContributionsByGoal, setCycleContributionsByGoal] = useState<Record<string, number>>({});

  const adjustments = getMonthAdjustments(userId, month);
  const movableGoals = useMemo(
    () => getMovableGoalSources(goals, adjustments.pausedGoalIds, adjustments.goalReallocationCents),
    [adjustments.goalReallocationCents, adjustments.pausedGoalIds, goals],
  );

  const deficitCents = computeDeficitCents(safeToSpendCents);
  const activeSavingsContributionCents = computeActiveSavingsContributionCents({
    savingsAllocationCents,
    pausedGoalsBoostCents,
    goalReallocationBoostCents,
  });

  const maxReductionCents = activeSavingsContributionCents;

  const quickOptionReductionCents = useMemo(() => {
    const buffers: Record<typeof selectedQuickOption, number> = {
      deficit: deficitCents,
      buffer50: deficitCents + 5000,
      buffer100: deficitCents + 10000,
    };
    return Math.min(buffers[selectedQuickOption], maxReductionCents);
  }, [deficitCents, maxReductionCents, selectedQuickOption]);

  const reductionCents = useMemo(() => {
    const parsed = parseFloat(reductionInput);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return Math.min(eurosToCents(parsed), maxReductionCents);
  }, [maxReductionCents, reductionInput]);

  const projection = useMemo(
    () =>
      projectAfterSavingsReduction({
        safeToSpendCents,
        activeSavingsContributionCents,
        reductionCents,
      }),
    [activeSavingsContributionCents, reductionCents, safeToSpendCents],
  );

  const loadCycleContributions = useCallback(async () => {
    if (!userId || isDemoMode) {
      setCycleContributionsByGoal({});
      return;
    }
    const { startIso, endIso } = resolveCycleWindowIso(month, incomeCycle, cycleStartIso, cycleEndIso);
    const byGoal = await fetchCycleContributionsByGoal(userId, startIso, endIso);
    setCycleContributionsByGoal(byGoal);
  }, [cycleEndIso, cycleStartIso, incomeCycle, isDemoMode, month, userId]);

  const openSheet = useCallback(() => {
    if (deficitCents <= 0 || maxReductionCents <= 0) return;
    const defaultEuros = (Math.min(deficitCents, maxReductionCents) / 100).toFixed(2);
    setReductionInput(defaultEuros);
    setSelectedQuickOption("deficit");
    setOpen(true);
    void loadCycleContributions();
  }, [deficitCents, loadCycleContributions, maxReductionCents]);

  const applyQuickOption = useCallback(
    (option: "deficit" | "buffer50" | "buffer100") => {
      setSelectedQuickOption(option);
      const buffers = {
        deficit: deficitCents,
        buffer50: deficitCents + 5000,
        buffer100: deficitCents + 10000,
      };
      const cents = Math.min(buffers[option], maxReductionCents);
      setReductionInput((cents / 100).toFixed(2));
    },
    [deficitCents, maxReductionCents],
  );

  useEffect(() => {
    if (!open) return;
    const defaultEuros = (Math.min(deficitCents, maxReductionCents) / 100).toFixed(2);
    if (!reductionInput) {
      setReductionInput(defaultEuros);
    }
  }, [deficitCents, maxReductionCents, open, reductionInput]);

  const reductionError =
    reductionCents <= 0
      ? "Enter an amount greater than zero."
      : reductionCents > maxReductionCents
        ? `Maximum reduction is ${formatMoney(maxReductionCents, currency)}`
        : null;

  const canConfirm = reductionCents > 0 && reductionCents <= maxReductionCents && !isSaving;

  const applyAdjustment = async () => {
    if (!canConfirm) return;

    if (isDemoMode) {
      toast.info("Sample budget", { description: "Sign in to adjust savings on your real budget." });
      setOpen(false);
      return;
    }

    const allocations = distributeSavingsReductionAcrossGoals(reductionCents, movableGoals);
    const allocatedTotal = Object.values(allocations).reduce((sum, cents) => sum + cents, 0);
    if (allocatedTotal <= 0) {
      toast.error("No savings allocation available to reduce this cycle.");
      return;
    }

    const prev = getMonthAdjustments(userId, month);
    const beforeSafe = safeToSpendCents;
    const afterSafe = beforeSafe + allocatedTotal;

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_move_from_savings",
          label: "Adjust savings for this cycle",
          amountCents: allocatedTotal,
          oldValueCents: beforeSafe,
          newValueCents: afterSafe,
        },
        () => {
          const nextRealloc = { ...prev.goalReallocationCents };
          for (const [goalId, amount] of Object.entries(allocations)) {
            nextRealloc[goalId] = (nextRealloc[goalId] ?? 0) + amount;
          }
          setMonthAdjustments(userId, month, {
            goalReallocationCents: nextRealloc,
          });
        },
      );

      for (const [goalId, amount] of Object.entries(allocations)) {
        const contributed = cycleContributionsByGoal[goalId] ?? 0;
        const transferBackCents = Math.min(amount, contributed);
        if (transferBackCents > 0) {
          await onTransferBack(goalId, transferBackCents);
        }
      }

      const updated = getMonthAdjustments(userId, month);
      await persistMonthAdjustmentsToSupabase(userId, month, updated);

      onDecided();
      setOpen(false);

      toast.success("Savings adjusted successfully.", {
        duration: 2500,
      });
    } catch (error) {
      console.error("[adjust_savings] failed", error);
      toast.error("Could not save your adjustment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    open,
    setOpen,
    isSaving,
    openSheet,
    reductionInput,
    setReductionInput,
    selectedQuickOption,
    applyQuickOption,
    deficitCents,
    activeSavingsContributionCents,
    maxReductionCents,
    reductionCents,
    projection,
    reductionError,
    canConfirm,
    applyAdjustment,
    quickOptionReductionCents,
  };
}
