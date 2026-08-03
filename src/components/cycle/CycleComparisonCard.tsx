import { CycleStatusPill } from "@/components/cycle/CycleStatusPill";
import { formatMoney } from "@/utils/money";
import type { ComparisonModel, ComparisonStat } from "@/utils/cycleReviewModel";

export function CycleComparisonCard({
  model,
  currency,
}: {
  model: ComparisonModel;
  currency: string;
}) {
  return (
    <section className="card-dashboard space-y-4 rounded-[1.5rem] border border-[#E8DFCC] p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Cycle vs cycle
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{model.subtitle}</p>
        </div>
        {model.helperText ? (
          <p className="text-xs text-muted-foreground">{model.helperText}</p>
        ) : null}
      </header>

      {!model.available ? (
        <p className="rounded-2xl bg-[#F6F0E4]/80 px-4 py-3 text-sm text-muted-foreground">
          {model.emptyReason}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {model.stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} currency={currency} />
          ))}
        </div>
      )}
    </section>
  );
}

function StatCard({
  stat,
  currency,
}: {
  stat: ComparisonStat;
  currency: string;
}) {
  return (
    <div className="rounded-2xl bg-[#F6F0E4]/70 p-4">
      <p className="label-caps text-muted-foreground">{stat.label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">
        {formatStatValue(stat.valueLabel, currency)}
      </p>
      {stat.badgeText ? (
        <div className="mt-3">
          <CycleStatusPill tone={stat.badgeTone ?? "info"}>
            {formatBadge(stat.badgeText, currency)}
          </CycleStatusPill>
        </div>
      ) : null}
    </div>
  );
}

function formatStatValue(raw: string, currency: string): string {
  const m = raw.match(/^__CENTS__(-?\d+)$/);
  if (m) return formatMoney(Number(m[1]), currency);
  return raw;
}

function formatBadge(raw: string, currency: string): string {
  const delta = raw.match(/^__DELTA__([+-]?\d+)\s*(.*)$/);
  if (delta) {
    const cents = Number(delta[1]);
    const rest = delta[2] || "vs last cycle";
    const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
    return `${sign}${formatMoney(Math.abs(cents), currency)} ${rest}`.trim();
  }
  return raw;
}
