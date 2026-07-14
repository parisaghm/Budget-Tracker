import { cn } from "@/lib/utils";

export interface PlanSegmentBarProps {
  salaryCents: number;
  fixedBillsCents: number;
  savingsAllocationCents: number;
  spentSoFarCents: number;
  remainingCents: number;
  /** Accessible label override for the segment bar. */
  ariaLabel?: string;
  className?: string;
}

export function PlanSegmentBar({
  salaryCents,
  fixedBillsCents,
  savingsAllocationCents,
  spentSoFarCents,
  remainingCents,
  ariaLabel = "Budget allocation: bills, goals, spent, and remaining",
  className,
}: PlanSegmentBarProps) {
  const total = Math.max(
    salaryCents,
    fixedBillsCents + savingsAllocationCents + spentSoFarCents + Math.max(0, remainingCents),
  );
  if (total <= 0) return null;

  const pct = (value: number) => `${Math.max(0, (value / total) * 100)}%`;

  return (
    <div className={cn("segment-bar", className)} role="img" aria-label={ariaLabel}>
      {fixedBillsCents > 0 ? (
        <span style={{ width: pct(fixedBillsCents), background: "hsl(var(--segment-bills))" }} />
      ) : null}
      {savingsAllocationCents > 0 ? (
        <span
          style={{ width: pct(savingsAllocationCents), background: "hsl(var(--segment-goals))" }}
        />
      ) : null}
      {spentSoFarCents > 0 ? (
        <span style={{ width: pct(spentSoFarCents), background: "hsl(var(--segment-spent))" }} />
      ) : null}
      {remainingCents > 0 ? (
        <span style={{ width: pct(remainingCents), background: "hsl(var(--segment-safe))" }} />
      ) : null}
    </div>
  );
}

export interface PlanStatTileProps {
  label: string;
  value: string;
  sub?: string;
  accentClass?: string;
}

export function PlanStatTile({ label, value, sub, accentClass }: PlanStatTileProps) {
  return (
    <div className="plan-stat-tile">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-sm", accentClass)} aria-hidden />
        <p className="label-caps">{label}</p>
      </div>
      <p className="money-display text-xl leading-none sm:text-2xl">{value}</p>
      {sub ? <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
