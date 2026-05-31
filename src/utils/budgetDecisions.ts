export type RolloverChoice = "add_to_budget" | "move_to_savings" | "add_to_goal" | "ignore";
export type OverspendChoice = "reduce_weekly" | "use_leftover" | "move_category" | "ignore";

export type BudgetActionType =
  | "rollover_carry"
  | "rollover_clear"
  | "rollover_savings"
  | "rollover_goal"
  | "rollover_ignore"
  | "overspend_reduce_weekly"
  | "overspend_use_leftover"
  | "overspend_ignore"
  | "pace_move_from_savings"
  | "pace_pause_goal"
  | "pace_reduce_daily_pace"
  | "reset_month_plan";

export interface MonthBudgetAdjustments {
  rolloverBoostCents: number;
  weeklyReductionCents: number;
  leftoverCoverCents: number;
  /** Goal IDs paused for this month — monthly allocation returns to spending room. */
  pausedGoalIds: string[];
  /** User-set daily pace target until payday (cents). */
  dailyPaceTargetCents: number | null;
}

export interface RolloverDecisionRecord {
  choice: RolloverChoice;
  amountCents: number;
  goalId?: string;
  decidedAt: string;
}

export interface OverspendDecisionRecord {
  choice: OverspendChoice;
  amountCents: number;
  decidedAt: string;
}

export interface BudgetPlanSnapshot {
  adjustments: MonthBudgetAdjustments;
  rolloverDecision: RolloverDecisionRecord | null;
  overspendDecision: OverspendDecisionRecord | null;
}

export interface BudgetActionHistoryEntry {
  id: string;
  actionType: BudgetActionType;
  label: string;
  amountCents?: number;
  oldValueCents?: number;
  newValueCents?: number;
  timestamp: string;
  /** State before this action — restored on undo. */
  snapshot: BudgetPlanSnapshot;
}

const ADJUSTMENTS_KEY = "bt_month_adjustments_v1";
const ROLLOVER_KEY = "bt_rollover_decision_v1";
const OVERSPEND_KEY = "bt_overspend_decision_v1";
const HISTORY_KEY = "bt_budget_action_history_v1";

const EMPTY_ADJUSTMENTS: MonthBudgetAdjustments = {
  rolloverBoostCents: 0,
  weeklyReductionCents: 0,
  leftoverCoverCents: 0,
  pausedGoalIds: [],
  dailyPaceTargetCents: null,
};

function normalizeAdjustments(raw: Partial<MonthBudgetAdjustments> | undefined): MonthBudgetAdjustments {
  return {
    ...EMPTY_ADJUSTMENTS,
    ...raw,
    pausedGoalIds: raw?.pausedGoalIds ?? [],
    dailyPaceTargetCents: raw?.dailyPaceTargetCents ?? null,
  };
}

function monthKey(userId: string, month: string): string {
  return `${userId}:${month}`;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export function captureBudgetPlanSnapshot(userId: string, month: string): BudgetPlanSnapshot {
  return {
    adjustments: { ...getMonthAdjustments(userId, month) },
    rolloverDecision: getRolloverDecision(userId, month),
    overspendDecision: getOverspendDecision(userId, month),
  };
}

function restoreBudgetPlanSnapshot(userId: string, month: string, snapshot: BudgetPlanSnapshot): void {
  const allAdj = readJson<Record<string, MonthBudgetAdjustments>>(ADJUSTMENTS_KEY) ?? {};
  allAdj[monthKey(userId, month)] = { ...snapshot.adjustments };
  writeJson(ADJUSTMENTS_KEY, allAdj);

  const allRollover = readJson<Record<string, RolloverDecisionRecord>>(ROLLOVER_KEY) ?? {};
  const rk = monthKey(userId, month);
  if (snapshot.rolloverDecision) {
    allRollover[rk] = snapshot.rolloverDecision;
  } else {
    delete allRollover[rk];
  }
  writeJson(ROLLOVER_KEY, allRollover);

  const allOverspend = readJson<Record<string, OverspendDecisionRecord>>(OVERSPEND_KEY) ?? {};
  const ok = monthKey(userId, month);
  if (snapshot.overspendDecision) {
    allOverspend[ok] = snapshot.overspendDecision;
  } else {
    delete allOverspend[ok];
  }
  writeJson(OVERSPEND_KEY, allOverspend);
}

export function getMonthAdjustments(userId: string, month: string): MonthBudgetAdjustments {
  const all = readJson<Record<string, MonthBudgetAdjustments>>(ADJUSTMENTS_KEY) ?? {};
  return normalizeAdjustments(all[monthKey(userId, month)]);
}

export function setMonthAdjustments(
  userId: string,
  month: string,
  patch: Partial<MonthBudgetAdjustments>,
): MonthBudgetAdjustments {
  const all = readJson<Record<string, MonthBudgetAdjustments>>(ADJUSTMENTS_KEY) ?? {};
  const next = normalizeAdjustments({ ...getMonthAdjustments(userId, month), ...patch });
  all[monthKey(userId, month)] = next;
  writeJson(ADJUSTMENTS_KEY, all);
  return next;
}

export function getRolloverDecision(userId: string, month: string): RolloverDecisionRecord | null {
  const all = readJson<Record<string, RolloverDecisionRecord>>(ROLLOVER_KEY) ?? {};
  return all[monthKey(userId, month)] ?? null;
}

export function setRolloverDecision(
  userId: string,
  month: string,
  record: RolloverDecisionRecord | null,
): void {
  const all = readJson<Record<string, RolloverDecisionRecord>>(ROLLOVER_KEY) ?? {};
  const key = monthKey(userId, month);
  if (record) {
    all[key] = record;
  } else {
    delete all[key];
  }
  writeJson(ROLLOVER_KEY, all);
}

export function getOverspendDecision(userId: string, month: string): OverspendDecisionRecord | null {
  const all = readJson<Record<string, OverspendDecisionRecord>>(OVERSPEND_KEY) ?? {};
  return all[monthKey(userId, month)] ?? null;
}

export function setOverspendDecision(
  userId: string,
  month: string,
  record: OverspendDecisionRecord | null,
): void {
  const all = readJson<Record<string, OverspendDecisionRecord>>(OVERSPEND_KEY) ?? {};
  const key = monthKey(userId, month);
  if (record) {
    all[key] = record;
  } else {
    delete all[key];
  }
  writeJson(OVERSPEND_KEY, all);
}

export function getBudgetActionHistory(userId: string, month: string): BudgetActionHistoryEntry[] {
  const all = readJson<Record<string, BudgetActionHistoryEntry[]>>(HISTORY_KEY) ?? {};
  return all[monthKey(userId, month)] ?? [];
}

function pushBudgetActionHistory(
  userId: string,
  month: string,
  entry: Omit<BudgetActionHistoryEntry, "id" | "timestamp">,
): BudgetActionHistoryEntry {
  const all = readJson<Record<string, BudgetActionHistoryEntry[]>>(HISTORY_KEY) ?? {};
  const key = monthKey(userId, month);
  const list = all[key] ?? [];
  const full: BudgetActionHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  all[key] = [...list, full].slice(-20);
  writeJson(HISTORY_KEY, all);
  return full;
}

/** Apply a plan change with undo history. Does not mutate monthly income in Supabase. */
export function applyBudgetPlanChange(
  userId: string,
  month: string,
  meta: Omit<BudgetActionHistoryEntry, "id" | "timestamp" | "snapshot">,
  applyFn: () => void,
): void {
  const snapshot = captureBudgetPlanSnapshot(userId, month);
  applyFn();
  pushBudgetActionHistory(userId, month, { ...meta, snapshot });
}

export function undoLastBudgetAction(userId: string, month: string): boolean {
  const all = readJson<Record<string, BudgetActionHistoryEntry[]>>(HISTORY_KEY) ?? {};
  const key = monthKey(userId, month);
  const list = all[key] ?? [];
  const last = list[list.length - 1];
  if (!last) return false;

  restoreBudgetPlanSnapshot(userId, month, last.snapshot);
  all[key] = list.slice(0, -1);
  writeJson(HISTORY_KEY, all);
  return true;
}

/** Clears local plan adjustments for the month; does not delete expenses, bills, or income. */
export function resetMonthBudgetPlan(userId: string, month: string): void {
  const snapshot = captureBudgetPlanSnapshot(userId, month);

  const allAdj = readJson<Record<string, MonthBudgetAdjustments>>(ADJUSTMENTS_KEY) ?? {};
  delete allAdj[monthKey(userId, month)];
  writeJson(ADJUSTMENTS_KEY, allAdj);

  const allRollover = readJson<Record<string, RolloverDecisionRecord>>(ROLLOVER_KEY) ?? {};
  delete allRollover[monthKey(userId, month)];
  writeJson(ROLLOVER_KEY, allRollover);

  const allOverspend = readJson<Record<string, OverspendDecisionRecord>>(OVERSPEND_KEY) ?? {};
  delete allOverspend[monthKey(userId, month)];
  writeJson(OVERSPEND_KEY, allOverspend);

  pushBudgetActionHistory(userId, month, {
    actionType: "reset_month_plan",
    label: "Reset this month's plan",
    snapshot,
  });
}

export function shouldShowRolloverPrompt(
  leftoverCents: number,
  decision: RolloverDecisionRecord | null,
): boolean {
  return leftoverCents > 0 && decision === null;
}

export function shouldShowOverspendGuidance(
  safeToSpendCents: number,
  decision: OverspendDecisionRecord | null,
): boolean {
  return safeToSpendCents < 0 && decision === null;
}

export interface RolloverBoostLine {
  label: string;
  amountCents: number;
  actionType: BudgetActionType;
}

/** Explains how rolloverBoostCents was built from local plan action history. */
export function getRolloverBoostBreakdown(userId: string, month: string): {
  totalCents: number;
  lines: RolloverBoostLine[];
  storageKey: string;
  rolloverDecision: RolloverDecisionRecord | null;
} {
  const adjustments = getMonthAdjustments(userId, month);
  const history = getBudgetActionHistory(userId, month);
  const rolloverDecision = getRolloverDecision(userId, month);
  const lines: RolloverBoostLine[] = [];

  for (const entry of history) {
    if (!entry.amountCents || entry.amountCents <= 0) continue;
    if (entry.actionType === "rollover_carry") {
      lines.push({
        label: "Carried over from last month (confirmed)",
        amountCents: entry.amountCents,
        actionType: entry.actionType,
      });
    } else if (entry.actionType === "overspend_use_leftover") {
      lines.push({
        label: "Used last month's leftover (overspend adjustment)",
        amountCents: entry.amountCents,
        actionType: entry.actionType,
      });
    } else if (entry.actionType === "pace_move_from_savings") {
      lines.push({
        label: "Moved from savings (pace support)",
        amountCents: entry.amountCents,
        actionType: entry.actionType,
      });
    }
  }

  const explainedCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const remainder = adjustments.rolloverBoostCents - explainedCents;
  if (remainder > 0) {
    lines.push({
      label: "Unrecorded adjustment (stored locally)",
      amountCents: remainder,
      actionType: "rollover_carry",
    });
  }

  return {
    totalCents: adjustments.rolloverBoostCents,
    lines,
    storageKey: `${ADJUSTMENTS_KEY} → ${monthKey(userId, month)}.rolloverBoostCents`,
    rolloverDecision,
  };
}

/** Removes all rollover boost from this month's plan (localStorage only). */
export function clearRolloverBoostCents(userId: string, month: string): void {
  const prev = getMonthAdjustments(userId, month);
  if (prev.rolloverBoostCents <= 0 && prev.leftoverCoverCents <= 0) return;

  applyBudgetPlanChange(
    userId,
    month,
    {
      actionType: "rollover_clear",
      label: "Remove carried-over amount",
      oldValueCents: prev.rolloverBoostCents,
      newValueCents: 0,
    },
    () => {
      setMonthAdjustments(userId, month, {
        rolloverBoostCents: 0,
        leftoverCoverCents: 0,
      });
      const rollover = getRolloverDecision(userId, month);
      if (rollover?.choice === "add_to_budget") {
        setRolloverDecision(userId, month, null);
      }
    },
  );
}
