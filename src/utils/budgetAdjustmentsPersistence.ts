import { supabase } from "@/lib/supabase/client";
import type { MonthBudgetAdjustments } from "@/utils/budgetDecisions";
import { getMonthAdjustments, setMonthAdjustments } from "@/utils/budgetDecisions";

function isMonthAdjustmentsSchemaError(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("month_adjustments") &&
    (normalized.includes("does not exist") ||
      normalized.includes("column") ||
      normalized.includes("schema cache"))
  );
}

export async function fetchMonthAdjustmentsFromSupabase(
  userId: string,
  month: string,
): Promise<MonthBudgetAdjustments | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("month_adjustments")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV && !isMonthAdjustmentsSchemaError(error.message)) {
      console.warn("[user_settings] fetch month_adjustments failed", error.message);
    }
    return null;
  }

  const raw = data?.month_adjustments;
  if (!raw || typeof raw !== "object") return null;

  const entry = (raw as Record<string, Partial<MonthBudgetAdjustments>>)[month];
  if (!entry) return null;

  return {
    rolloverBoostCents: entry.rolloverBoostCents ?? 0,
    weeklyReductionCents: entry.weeklyReductionCents ?? 0,
    leftoverCoverCents: entry.leftoverCoverCents ?? 0,
    pausedGoalIds: entry.pausedGoalIds ?? [],
    dailyPaceTargetCents: entry.dailyPaceTargetCents ?? null,
    goalReallocationCents: entry.goalReallocationCents ?? {},
  };
}

export async function persistMonthAdjustmentsToSupabase(
  userId: string,
  month: string,
  adjustments: MonthBudgetAdjustments,
): Promise<boolean> {
  const { data: existing, error: fetchError } = await supabase
    .from("user_settings")
    .select("month_adjustments")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError && !isMonthAdjustmentsSchemaError(fetchError.message)) {
    if (import.meta.env.DEV) {
      console.warn("[user_settings] read month_adjustments failed", fetchError.message);
    }
    return false;
  }

  const prior =
    existing?.month_adjustments && typeof existing.month_adjustments === "object"
      ? (existing.month_adjustments as Record<string, MonthBudgetAdjustments>)
      : {};

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      month_adjustments: {
        ...prior,
        [month]: adjustments,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (import.meta.env.DEV && !isMonthAdjustmentsSchemaError(error.message)) {
      console.warn("[user_settings] upsert month_adjustments failed", error.message);
    }
    return false;
  }

  return true;
}

function hasAdjustmentData(adjustments: MonthBudgetAdjustments): boolean {
  return (
    adjustments.rolloverBoostCents > 0 ||
    adjustments.weeklyReductionCents > 0 ||
    adjustments.leftoverCoverCents > 0 ||
    adjustments.pausedGoalIds.length > 0 ||
    adjustments.dailyPaceTargetCents != null ||
    Object.keys(adjustments.goalReallocationCents).length > 0
  );
}

/**
 * Sync month adjustments between Supabase and localStorage.
 * - When Supabase has data for the month it is authoritative: local mirrors it.
 * - When Supabase has no data but localStorage does, push the local
 *   adjustments up once so they are preserved remotely.
 * Never overwrites non-empty Supabase data with localStorage.
 */
export async function hydrateMonthAdjustmentsFromSupabase(
  userId: string,
  month: string,
): Promise<void> {
  const remote = await fetchMonthAdjustmentsFromSupabase(userId, month);
  const local = getMonthAdjustments(userId, month);

  if (remote) {
    setMonthAdjustments(userId, month, remote);
    return;
  }

  if (hasAdjustmentData(local)) {
    await persistMonthAdjustmentsToSupabase(userId, month, local);
  }
}
