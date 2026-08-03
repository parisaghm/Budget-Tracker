import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CycleStatusPill, type PillTone } from "@/components/cycle/CycleStatusPill";
import type { FinishedCycleSummary } from "@/utils/cycleReviewModel";
import { formatMoney } from "@/utils/money";

export function FinishedCyclesCard({
  cycles,
  totalCount,
  currency,
  showAll,
  onToggleShowAll,
  onPlayRecap,
}: {
  cycles: FinishedCycleSummary[];
  totalCount: number;
  currency: string;
  showAll: boolean;
  onToggleShowAll: () => void;
  onPlayRecap: (cycleId: string) => void;
}) {
  return (
    <section className="card-dashboard space-y-4 rounded-[1.5rem] border border-[#E8DFCC] p-5 sm:p-6">
      <header>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Finished cycles
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every closed cycle keeps its verdict. Open any recap to revisit it.
        </p>
      </header>

      {cycles.length === 0 ? (
        <p className="rounded-2xl bg-[#F6F0E4]/80 px-4 py-3 text-sm text-muted-foreground">
          Your first completed-cycle recap will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {cycles.map((row) => (
            <FinishedCycleRow
              key={row.cycle.id}
              row={row}
              currency={currency}
              canPlayRecap={row.actualSpentCents > 0}
              onPlayRecap={() => onPlayRecap(row.cycle.id)}
            />
          ))}
        </ul>
      )}

      {totalCount > 5 ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-sm text-primary"
          onClick={onToggleShowAll}
        >
          {showAll ? "Show fewer cycles" : "View all cycles"}
        </Button>
      ) : null}
    </section>
  );
}

export function FinishedCycleRow({
  row,
  currency,
  canPlayRecap = true,
  onPlayRecap,
}: {
  row: FinishedCycleSummary;
  currency: string;
  canPlayRecap?: boolean;
  onPlayRecap: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[#E8DFCC]/80 bg-[#FFFDF8]/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{row.rangeLabel}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {formatResultLine(row.resultLine, currency)}
        </p>
        <CycleStatusPill tone={verdictTone(row.verdict.verdict)}>
          {row.verdict.label}
        </CycleStatusPill>
      </div>
      {canPlayRecap ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full border-[#E8DFCC]"
          onClick={onPlayRecap}
          aria-label={`Play recap for ${row.rangeLabel}`}
        >
          <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Recap
        </Button>
      ) : null}
    </li>
  );
}

function verdictTone(
  verdict: FinishedCycleSummary["verdict"]["verdict"],
): PillTone {
  switch (verdict) {
    case "on_plan":
      return "healthy";
    case "mixed":
      return "caution";
    case "tough":
      return "over_plan";
    default:
      return "info";
  }
}

function formatResultLine(raw: string | null, currency: string): string {
  if (!raw) return "Details unavailable.";
  let out = raw;
  out = out.replace(/__UNDER__(\d+)/g, (_, n) =>
    `${formatMoney(Number(n), currency)} under plan`,
  );
  out = out.replace(/__OVER__(\d+)/g, (_, n) =>
    `${formatMoney(Number(n), currency)} over plan`,
  );
  out = out.replace(/__CENTS__(\d+)/g, (_, n) => formatMoney(Number(n), currency));
  return out;
}
