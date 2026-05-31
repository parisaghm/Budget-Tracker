import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";

/** Income cycle preference (local) wired through finance data context. */
export function useIncomeCycle() {
  const {
    incomeCycle,
    isIncomeCycleConfigured,
    saveIncomeCycle,
    isLoading,
  } = useSupabaseFinanceData();

  return {
    incomeCycle,
    isConfigured: isIncomeCycleConfigured,
    isReady: !isLoading,
    save: saveIncomeCycle,
  };
}
