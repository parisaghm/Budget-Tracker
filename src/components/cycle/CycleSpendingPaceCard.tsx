import { Check } from "lucide-react";
import { CycleStatusPill } from "@/components/cycle/CycleStatusPill";
import { CumulativeCycleChart } from "@/components/cycle/CumulativeCycleChart";
import { formatMoney } from "@/utils/money";
import type { PaceModel } from "@/utils/cycleReviewModel";

export function CycleSpendingPaceCard({
  pace,
  currency,
}: {
  pace: PaceModel;
  currency: string;
}) {
  const { progress } = pace;
  const planPct = pace.planUsedPercentDisplay;
  const explanation = buildPaceExplanation(pace, currency);

  return (
    <section className="card-dashboard space-y-5 rounded-[1.5rem] border border-border p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Spending pace
        </h2>
        <p className="text-xs text-muted-foreground">
          {pace.cycleRangeLabel} · {pace.cycleStatusLabel}
        </p>
      </header>

      <div className="space-y-3">
        <ProgressRow
          label={`${progress.elapsedPercentDisplay}% · day ${progress.cycleDay} of ${progress.cycleLength}`}
          caption="Cycle time gone"
          percent={progress.elapsedPercentDisplay}
          barClass="bg-muted"
        />
        <ProgressRow
          label={
            pace.hasPlannedExpenses && planPct != null
              ? `${planPct}% · ${formatMoney(pace.actualSpentCents, currency)} of ${formatMoney(pace.plannedExpensesCents, currency)}`
              : "Set category budgets to compare with your plan"
          }
          caption="Plan used"
          percent={planPct ?? 0}
          barClass="bg-primary/70"
          markerPercent={
            pace.hasPlannedExpenses ? progress.elapsedPercentDisplay : null
          }
        />
      </div>

      <CycleStatusPill
        tone={
          pace.status === "on_pace"
            ? "healthy"
            : pace.status === "faster"
              ? "over_plan"
              : pace.status === "slightly_ahead"
                ? "caution"
                : "info"
        }
      >
        {pace.status === "on_pace" ? (
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" aria-hidden />
            {pace.statusMessage}
          </span>
        ) : (
          pace.statusMessage
        )}
      </CycleStatusPill>

      <CumulativeCycleChart pace={pace} currency={currency} />

      {explanation ? (
        <p className="rounded-2xl bg-card/80 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {explanation}
        </p>
      ) : null}
    </section>
  );
}

function ProgressRow({
  label,
  caption,
  percent,
  barClass,
  markerPercent,
}: {
  label: string;
  caption: string;
  percent: number;
  barClass: string;
  markerPercent?: number | null;
}) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">{caption}</p>
        <p className="text-xs font-medium tabular-nums text-foreground">{label}</p>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
        {markerPercent != null ? (
          <div
            className="absolute top-0 h-full w-px bg-foreground/50"
            style={{ left: `${Math.min(100, Math.max(0, markerPercent))}%` }}
            title="TIME"
          />
        ) : null}
      </div>
    </div>
  );
}

function buildPaceExplanation(pace: PaceModel, currency: string): string | null {
  if (pace.explanation === "Projection will become more useful after a few days of spending.") {
    return pace.explanation;
  }

  const projected = pace.projection.projectedSpendCents;
  if (projected == null || !pace.hasPlannedExpenses) {
    if (pace.projection.kind === "early_estimate" && projected != null) {
      return `Early estimate: at today’s pace you might finish around ${formatMoney(projected, currency)}.`;
    }
    return null;
  }

  const delta = pace.plannedExpensesCents - projected;
  const underOver =
    delta >= 0
      ? `about ${formatMoney(delta, currency)} under plan`
      : `about ${formatMoney(-delta, currency)} over plan`;

  const early =
    pace.projection.kind === "early_estimate" ? " (early estimate)" : "";

  let oneOff = "";
  const largest = pace.series.largestOneOff;
  if (largest && largest.amountCents >= pace.actualSpentCents * 0.35) {
    oneOff = ` The largest single expense was ${largest.label} (${formatMoney(largest.amountCents, currency)}).`;
  }

  return `At today’s pace you’ll finish around ${formatMoney(projected, currency)}${early} — ${underOver}.${oneOff}`;
}
