import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
  dashboardQueryKey,
  billsQueryKey,
  expensesQueryKey,
  incomeQueryKey,
} from "@/hooks/useCycleIncome";
import {
  mergeCycleContributions,
  type CycleContributionRow,
} from "@/utils/savingsAllocation";

export function goalContributionsQueryKey(
  userId: string | undefined,
  cycleId: string | undefined,
) {
  return ["goal-contributions", userId ?? null, cycleId ?? null] as const;
}

export function cycleSavingsSummaryQueryKey(
  userId: string | undefined,
  cycleId: string | undefined,
) {
  return ["cycle-savings-summary", userId ?? null, cycleId ?? null] as const;
}

export function goalsQueryKey(userId: string | undefined) {
  return ["goals", userId ?? null] as const;
}

async function fetchCycleContributionsMerged(params: {
  userId: string;
  cycleId: string;
  cycleStartIso: string;
  cycleEndIso: string;
}): Promise<Record<string, number>> {
  const { userId, cycleId, cycleStartIso, cycleEndIso } = params;

  const { data: cycleRows, error: cycleError } = await supabase
    .from("goal_contributions")
    .select("id, goal_id, amount_cents, cycle_id, created_at")
    .eq("user_id", userId)
    .eq("cycle_id", cycleId);

  if (cycleError) throw new Error(cycleError.message);

  const { data: legacyRows, error: legacyError } = await supabase
    .from("goal_contributions")
    .select("id, goal_id, amount_cents, cycle_id, created_at")
    .eq("user_id", userId)
    .is("cycle_id", null)
    .gte("created_at", `${cycleStartIso}T00:00:00`)
    .lt("created_at", `${cycleEndIso}T23:59:59.999`);

  if (legacyError) throw new Error(legacyError.message);

  return mergeCycleContributions({
    cycleId,
    cycleIdRows: (cycleRows ?? []) as CycleContributionRow[],
    legacyRows: (legacyRows ?? []) as CycleContributionRow[],
  });
}

export async function invalidateAllocationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  cycleId: string | undefined,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: goalContributionsQueryKey(userId, cycleId) }),
    queryClient.invalidateQueries({ queryKey: cycleSavingsSummaryQueryKey(userId, cycleId) }),
    queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId, cycleId) }),
    queryClient.invalidateQueries({ queryKey: goalsQueryKey(userId) }),
    queryClient.invalidateQueries({ queryKey: incomeQueryKey(userId, cycleId) }),
    queryClient.invalidateQueries({ queryKey: expensesQueryKey(userId, cycleId) }),
    queryClient.invalidateQueries({ queryKey: billsQueryKey(userId, cycleId) }),
  ]);
}

export function useCycleGoalContributions(params: {
  userId: string | undefined;
  cycleId: string | undefined;
  cycleStartIso: string | null | undefined;
  cycleEndIso: string | null | undefined;
  onSaved?: () => void | Promise<void>;
}) {
  const { userId, cycleId, cycleStartIso, cycleEndIso, onSaved } = params;
  const queryClient = useQueryClient();
  const enabled = Boolean(userId && cycleId && cycleStartIso && cycleEndIso);

  const query = useQuery({
    queryKey: goalContributionsQueryKey(userId, cycleId),
    queryFn: () =>
      fetchCycleContributionsMerged({
        userId: userId!,
        cycleId: cycleId!,
        cycleStartIso: cycleStartIso!,
        cycleEndIso: cycleEndIso!,
      }),
    enabled,
  });

  const saveCycleAllocation = useMutation({
    mutationFn: async (
      allocations: Array<{ goal_id: string; amount_cents: number }>,
    ) => {
      if (!userId || !cycleId) throw new Error("Missing user or cycle");

      const { error } = await supabase.rpc("save_cycle_goal_allocation", {
        p_cycle_id: cycleId,
        p_allocations: allocations,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await invalidateAllocationQueries(queryClient, userId, cycleId);
      await onSaved?.();
    },
  });

  const contributionsByGoal = query.data ?? {};
  const allocatedThisCycleCents = Object.values(contributionsByGoal).reduce(
    (sum, n) => sum + Math.max(0, n),
    0,
  );

  return {
    contributionsByGoal,
    allocatedThisCycleCents,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    saveCycleAllocation,
    isSaving: saveCycleAllocation.isPending,
  };
}
