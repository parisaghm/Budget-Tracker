import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { IncomeEntry } from "@/types/budgetCycle";
import { mapIncomeEntryRow, sumIncomeEntriesCents } from "@/utils/budgetCycles";

export function incomeQueryKey(userId: string | undefined, cycleId: string | undefined) {
  return ["income", userId ?? null, cycleId ?? null] as const;
}

export function dashboardQueryKey(userId: string | undefined, cycleId: string | undefined) {
  return ["dashboard", userId ?? null, cycleId ?? null] as const;
}

export function expensesQueryKey(userId: string | undefined, cycleId: string | undefined) {
  return ["expenses", userId ?? null, cycleId ?? null] as const;
}

export function billsQueryKey(userId: string | undefined, cycleId: string | undefined) {
  return ["bills", userId ?? null, cycleId ?? null] as const;
}

async function fetchIncomeForCycle(userId: string, cycleId: string): Promise<IncomeEntry[]> {
  const { data, error } = await supabase
    .from("income_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIncomeEntryRow);
}

export function useCycleIncome(userId: string | undefined, cycleId: string | undefined) {
  const queryClient = useQueryClient();
  const enabled = Boolean(userId && cycleId);

  const query = useQuery({
    queryKey: incomeQueryKey(userId, cycleId),
    queryFn: () => fetchIncomeForCycle(userId!, cycleId!),
    enabled,
  });

  const invalidateCycleQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: incomeQueryKey(userId, cycleId) }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(userId, cycleId) }),
      queryClient.invalidateQueries({ queryKey: expensesQueryKey(userId, cycleId) }),
      queryClient.invalidateQueries({ queryKey: billsQueryKey(userId, cycleId) }),
    ]);
  };

  const addIncome = useMutation({
    mutationFn: async (input: {
      amountCents: number;
      receivedDate?: string | null;
      source?: string | null;
      note?: string | null;
    }) => {
      if (!userId || !cycleId) throw new Error("Missing user or cycle");
      if (input.amountCents <= 0) throw new Error("Amount must be positive");

      const { data, error } = await supabase
        .from("income_entries")
        .insert({
          user_id: userId,
          cycle_id: cycleId,
          amount_cents: input.amountCents,
          received_date: input.receivedDate ?? null,
          source: input.source ?? null,
          note: input.note ?? null,
          date_is_estimated: false,
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return mapIncomeEntryRow(data);
    },
    onSuccess: () => {
      void invalidateCycleQueries();
    },
  });

  const deleteIncome = useMutation({
    mutationFn: async (entryId: string) => {
      if (!userId) throw new Error("Missing user");
      const { error } = await supabase
        .from("income_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void invalidateCycleQueries();
    },
  });

  const entries = query.data ?? [];
  const totalIncomeCents = sumIncomeEntriesCents(entries);
  const hasIncomeForCycle = entries.length > 0;

  return {
    entries,
    totalIncomeCents,
    hasIncomeForCycle,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    addIncome,
    deleteIncome,
    invalidateCycleQueries,
  };
}
