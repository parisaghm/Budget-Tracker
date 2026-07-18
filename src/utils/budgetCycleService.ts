import { format, parseISO, startOfDay, startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import type { BudgetCycle } from "@/types/budgetCycle";
import type { IncomeCycle } from "@/types/incomeCycle";
import {
  computeCycleEndIso,
  findCycleContainingDate,
  mapBudgetCycleRow,
  scheduleTypeFromIncomeCycle,
  todayIso,
} from "@/utils/budgetCycles";
import { getActiveCycleWindow, isIncomeCycleConfigured } from "@/utils/incomeCycle";

type CycleRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
  schedule_type: string;
  created_at: string;
};

async function fetchCyclesForUser(userId: string): Promise<BudgetCycle[]> {
  const { data, error } = await supabase
    .from("budget_cycles")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as CycleRow[] | null)?.map(mapBudgetCycleRow) ?? [];
}

/**
 * Idempotent create/fetch via ensure_budget_cycle RPC.
 * On unique conflict, returns the existing row (does not overwrite frozen dates).
 */
export async function ensureBudgetCycle(params: {
  startDate: string;
  endDate: string;
  scheduleType: string;
  status?: "active" | "closed" | "scheduled";
}): Promise<BudgetCycle> {
  const { data, error } = await supabase.rpc("ensure_budget_cycle", {
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_schedule_type: params.scheduleType,
    p_status: params.status ?? "active",
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("ensure_budget_cycle returned no row");
  return mapBudgetCycleRow(data as CycleRow);
}

async function closeCycleIfNeeded(cycle: BudgetCycle): Promise<void> {
  if (cycle.status === "closed") return;
  const { error } = await supabase
    .from("budget_cycles")
    .update({ status: "closed" })
    .eq("id", cycle.id)
    .eq("user_id", cycle.userId);
  if (error) throw new Error(error.message);
}

/**
 * Ensure the chain of cycles reaches "today" with no gaps/overlaps.
 * Next cycle always starts at previous.end_date.
 * New schedule only affects end_date of newly created cycles (transition cycles).
 */
export async function ensureCyclesUpToToday(params: {
  userId: string;
  incomeCycle: IncomeCycle | null;
  today?: Date;
}): Promise<BudgetCycle[]> {
  const today = startOfDay(params.today ?? new Date());
  const todayStr = todayIso(today);
  let cycles = await fetchCyclesForUser(params.userId);

  // Bootstrap: no cycles yet
  if (cycles.length === 0) {
    if (isIncomeCycleConfigured(params.incomeCycle)) {
      const window = getActiveCycleWindow(params.incomeCycle, today);
      const startDate = format(window.start, "yyyy-MM-dd");
      const endDate = format(window.end, "yyyy-MM-dd");
      // getActiveCycleWindow can return start===end on payday; ensure exclusive end
      const safeEnd =
        endDate <= startDate
          ? computeCycleEndIso(params.incomeCycle, startDate)
          : endDate;
      await ensureBudgetCycle({
        startDate,
        endDate: safeEnd,
        scheduleType: scheduleTypeFromIncomeCycle(params.incomeCycle),
        status: "active",
      });
    } else {
      const start = startOfMonth(today);
      const startDate = format(start, "yyyy-MM-dd");
      const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      await ensureBudgetCycle({
        startDate,
        endDate: format(nextMonth, "yyyy-MM-dd"),
        scheduleType: "calendar_month",
        status: "active",
      });
    }
    cycles = await fetchCyclesForUser(params.userId);
  }

  // Advance while today is at/after the latest cycle end
  let guard = 0;
  while (guard < 36) {
    guard += 1;
    cycles = await fetchCyclesForUser(params.userId);
    const covering = findCycleContainingDate(cycles, todayStr);
    if (covering) {
      // Ensure at most one active; covering cycle should be active
      const othersActive = cycles.filter((c) => c.status === "active" && c.id !== covering.id);
      for (const other of othersActive) {
        await closeCycleIfNeeded(other);
      }
      if (covering.status !== "active") {
        await supabase
          .from("budget_cycles")
          .update({ status: "active" })
          .eq("id", covering.id)
          .eq("user_id", params.userId);
      }
      return fetchCyclesForUser(params.userId);
    }

    const latest = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    if (!latest) break;

    if (todayStr < latest.endDate) {
      // Gap before latest? shouldn't happen; return as-is
      return cycles;
    }

    // today >= latest.endDate → close and create next starting at latest.endDate
    await closeCycleIfNeeded(latest);

    const nextStart = latest.endDate;
    let nextEnd: string;
    let scheduleType: string;

    if (isIncomeCycleConfigured(params.incomeCycle)) {
      nextEnd = computeCycleEndIso(params.incomeCycle, nextStart);
      scheduleType = scheduleTypeFromIncomeCycle(params.incomeCycle);
    } else {
      const start = parseISO(nextStart);
      // Next 1st of month strictly after start (transition or calendar month)
      nextEnd = format(new Date(start.getFullYear(), start.getMonth() + 1, 1), "yyyy-MM-dd");
      if (nextEnd <= nextStart) {
        nextEnd = format(new Date(start.getFullYear(), start.getMonth() + 2, 1), "yyyy-MM-dd");
      }
      scheduleType = "calendar_month";
    }

    if (nextEnd <= nextStart) {
      throw new Error(`Invalid next cycle end ${nextEnd} for start ${nextStart}`);
    }

    await ensureBudgetCycle({
      startDate: nextStart,
      endDate: nextEnd,
      scheduleType,
      status: "active",
    });
  }

  return fetchCyclesForUser(params.userId);
}

export { fetchCyclesForUser };
