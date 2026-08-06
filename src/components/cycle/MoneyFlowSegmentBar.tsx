import { cn } from "@/lib/utils";
import type { MoneyFlowSegment } from "@/utils/cycleReviewModel";

const SEGMENT_COLORS: Record<MoneyFlowSegment["id"], string> = {
  fixed: "hsl(var(--segment-bills))",
  flexible: "hsl(var(--segment-spent))",
  non_monthly: "hsl(var(--muted-foreground))",
  savings: "hsl(var(--segment-goals))",
  left_over: "hsl(var(--segment-safe))",
};

export function MoneyFlowSegmentBar({
  segments,
  className,
}: {
  segments: MoneyFlowSegment[];
  className?: string;
}) {
  const positive = segments.filter((s) => s.amountCents > 0);
  const total = positive.reduce((sum, s) => sum + s.amountCents, 0);

  if (total <= 0) {
    return (
      <div
        className={cn(
          "h-3 w-full rounded-full bg-muted/60",
          className,
        )}
        role="img"
        aria-label="No money flow to display"
      />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40"
        role="img"
        aria-label={positive
          .map((s) => `${s.label} ${s.percentOfIncomeDisplay ?? 0}%`)
          .join(", ")}
      >
        {positive.map((s) => (
          <div
            key={s.id}
            style={{
              width: `${(s.amountCents / total) * 100}%`,
              backgroundColor: SEGMENT_COLORS[s.id],
            }}
            title={s.label}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {positive.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SEGMENT_COLORS[s.id] }}
              aria-hidden
            />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { SEGMENT_COLORS };
