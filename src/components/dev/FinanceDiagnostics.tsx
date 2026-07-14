import { formatMoney } from "@/utils/money";
import type { FinanceDiagnosticsSnapshot } from "@/hooks/useSupabaseFinanceData";

interface FinanceDiagnosticsProps {
  snapshot: FinanceDiagnosticsSnapshot;
}

export function FinanceDiagnostics({ snapshot }: FinanceDiagnosticsProps) {
  if (!import.meta.env.DEV) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Supabase host", value: snapshot.supabaseHost ?? "not configured" },
    { label: "User ID", value: snapshot.userId ?? "not signed in" },
    { label: "Income cycle", value: snapshot.incomeCycleConfigured ? "configured" : "not configured" },
    { label: "Cycle start", value: snapshot.cycleStart ?? "—" },
    { label: "Cycle end", value: snapshot.cycleEnd ?? "—" },
    { label: "Selected month key", value: snapshot.currentMonth },
    { label: "Month/cycle source", value: snapshot.monthSelectionSource },
    { label: "Settings source", value: snapshot.settingsSource },
    { label: "Income", value: formatMoney(snapshot.incomeCents) },
    { label: "Spent", value: formatMoney(snapshot.spentCents) },
    { label: "Savings", value: formatMoney(snapshot.savingsCents) },
    { label: "Bills due", value: formatMoney(snapshot.billsCents) },
    { label: "Settings hydrated", value: snapshot.settingsHydrated ? "yes" : "pending" },
  ];

  return (
    <details className="rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-3 text-xs">
      <summary className="cursor-pointer font-medium text-amber-800 dark:text-amber-200">
        Finance diagnostics (dev only)
      </summary>
      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{row.label}:</dt>
            <dd className="font-mono break-all">{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
