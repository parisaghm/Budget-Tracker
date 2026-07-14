import { useCallback, useEffect, useState } from "react";
import {
  getBudgetActionHistory,
  getMonthAdjustments,
  getOverspendDecision,
  getRolloverDecision,
  undoLastBudgetAction,
  type BudgetActionHistoryEntry,
  type MonthBudgetAdjustments,
  type OverspendDecisionRecord,
  type RolloverDecisionRecord,
} from "@/utils/budgetDecisions";

const STORAGE_KEYS = [
  "bt_month_adjustments_v1",
  "bt_rollover_decision_v1",
  "bt_overspend_decision_v1",
  "bt_budget_action_history_v1",
] as const;

export function useBudgetAdjustments(userId: string | undefined, month: string) {
  const [adjustments, setAdjustments] = useState<MonthBudgetAdjustments>({
    rolloverBoostCents: 0,
    weeklyReductionCents: 0,
    leftoverCoverCents: 0,
    pausedGoalIds: [],
    dailyPaceTargetCents: null,
    goalReallocationCents: {},
  });
  const [rolloverDecision, setRolloverDecisionState] = useState<RolloverDecisionRecord | null>(null);
  const [overspendDecision, setOverspendDecisionState] = useState<OverspendDecisionRecord | null>(null);
  const [actionHistory, setActionHistory] = useState<BudgetActionHistoryEntry[]>([]);

  const refresh = useCallback(() => {
    if (!userId) return;
    setAdjustments(getMonthAdjustments(userId, month));
    setRolloverDecisionState(getRolloverDecision(userId, month));
    setOverspendDecisionState(getOverspendDecision(userId, month));
    setActionHistory(getBudgetActionHistory(userId, month));
  }, [userId, month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && (STORAGE_KEYS as readonly string[]).includes(event.key)) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const undoLast = useCallback(() => {
    if (!userId) return false;
    const ok = undoLastBudgetAction(userId, month);
    refresh();
    return ok;
  }, [month, refresh, userId]);

  return {
    adjustments,
    rolloverDecision,
    overspendDecision,
    actionHistory,
    refresh,
    undoLast,
  };
}
