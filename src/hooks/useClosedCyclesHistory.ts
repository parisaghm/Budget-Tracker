import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { BudgetCycle } from "@/types/budgetCycle";
import { mapIncomeEntryRow, sumIncomeEntriesCents } from "@/utils/budgetCycles";
import {
  mergeCycleContributions,
  type CycleContributionRow,
} from "@/utils/savingsAllocation";
import { goalContributionsQueryKey } from "@/hooks/useCycleGoalContributions";
import { incomeQueryKey } from "@/hooks/useCycleIncome";

async function fetchIncomeTotal(userId: string, cycleId: string): Promise<number> {
  const { data, error } = await supabase
    .from("income_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("cycle_id", cycleId);
  if (error) throw new Error(error.message);
  return sumIncomeEntriesCents((data ?? []).map(mapIncomeEntryRow));
}

async function fetchContributionTotal(
  userId: string,
  cycle: BudgetCycle,
): Promise<{ total: number; hasRows: boolean }> {
  const { data: cycleRows, error: cycleError } = await supabase
    .from("goal_contributions")
    .select("id, goal_id, amount_cents, cycle_id, created_at")
    .eq("user_id", userId)
    .eq("cycle_id", cycle.id);
  if (cycleError) throw new Error(cycleError.message);

  const { data: legacyRows, error: legacyError } = await supabase
    .from("goal_contributions")
    .select("id, goal_id, amount_cents, cycle_id, created_at")
    .eq("user_id", userId)
    .is("cycle_id", null)
    .gte("created_at", `${cycle.startDate}T00:00:00`)
    .lt("created_at", `${cycle.endDate}T23:59:59.999`);
  if (legacyError) throw new Error(legacyError.message);

  const merged = mergeCycleContributions({
    cycleId: cycle.id,
    cycleIdRows: (cycleRows ?? []) as CycleContributionRow[],
    legacyRows: (legacyRows ?? []) as CycleContributionRow[],
  });
  const total = Object.values(merged).reduce((s, n) => s + Math.max(0, n), 0);
  const hasRows =
    (cycleRows?.length ?? 0) > 0 || (legacyRows?.length ?? 0) > 0 || total > 0;
  return { total, hasRows };
}

/**
 * Read-only loader for closed-cycle income and contribution totals.
 * Does not write finance records.
 */
export function useClosedCyclesHistory(params: {
  userId: string | undefined;
  closedCycles: BudgetCycle[];
}) {
  const { userId, closedCycles } = params;
  const enabled = Boolean(userId) && closedCycles.length > 0;

  const incomeQueries = useQueries({
    queries: closedCycles.map((cycle) => ({
      queryKey: [...incomeQueryKey(userId, cycle.id), "total"] as const,
      queryFn: () => fetchIncomeTotal(userId!, cycle.id),
      enabled,
      staleTime: 60_000,
    })),
  });

  const contributionQueries = useQueries({
    queries: closedCycles.map((cycle) => ({
      queryKey: [...goalContributionsQueryKey(userId, cycle.id), "total"] as const,
      queryFn: () => fetchContributionTotal(userId!, cycle),
      enabled,
      staleTime: 60_000,
    })),
  });

  return useMemo(() => {
    const incomeByCycleId: Record<string, number> = {};
    const contributionsByCycleId: Record<string, number> = {};
    const contributionAvailability: Record<string, boolean> = {};

    closedCycles.forEach((cycle, i) => {
      const income = incomeQueries[i]?.data;
      if (income != null) incomeByCycleId[cycle.id] = income;

      const contrib = contributionQueries[i]?.data;
      if (contrib != null) {
        contributionsByCycleId[cycle.id] = contrib.total;
        contributionAvailability[cycle.id] = true;
      }
    });

    const isLoading =
      incomeQueries.some((q) => q.isLoading) ||
      contributionQueries.some((q) => q.isLoading);

    return {
      incomeByCycleId,
      contributionsByCycleId,
      contributionAvailability,
      isLoading,
    };
  }, [closedCycles, incomeQueries, contributionQueries]);
}
