import { useId, useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import type { FinancialPace } from "@/utils/financialPace";
import { cn } from "@/lib/utils";

interface HeroCycleTrendProps {
  cycleStartLabel: string;
  cycleEndLabel: string;
  daysElapsed: number;
  daysTotal: number;
  startBalanceCents: number;
  currentBalanceCents: number;
  projectedEndCents: number;
  className?: string;
}

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

export function HeroCycleTrend({
  cycleStartLabel,
  cycleEndLabel,
  daysElapsed,
  daysTotal,
  startBalanceCents,
  currentBalanceCents,
  projectedEndCents,
  className,
}: HeroCycleTrendProps) {
  const fillGradientId = useId();

  const chart = useMemo(() => {
    const width = 220;
    const height = 76;
    const padX = 2;
    const padY = 6;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const baselineY = padY + innerH;

    const values = [
      Math.max(0, startBalanceCents),
      Math.max(0, currentBalanceCents),
      Math.max(0, projectedEndCents),
    ];
    const maxVal = Math.max(...values, 1);

    const progress = daysTotal > 0 ? Math.min(1, daysElapsed / daysTotal) : 0.5;
    const x0 = padX;
    const x1 = padX + innerW * progress;
    const x2 = padX + innerW;

    const yFor = (cents: number) => padY + innerH - (cents / maxVal) * innerH;

    const actualPoints = [
      { x: x0, y: yFor(startBalanceCents) },
      { x: x1, y: yFor(currentBalanceCents) },
    ];
    const forecastPoints = [
      { x: x1, y: yFor(currentBalanceCents) },
      { x: x2, y: yFor(projectedEndCents) },
    ];
    const actualPath = buildPath(actualPoints);
    const forecastPath = buildPath(forecastPoints);
    const fillPath = `${actualPath} L ${x2.toFixed(2)} ${baselineY.toFixed(2)} L ${x0.toFixed(2)} ${baselineY.toFixed(2)} Z`;

    return {
      width,
      height,
      baselineY,
      padX,
      innerW,
      actualPath,
      forecastPath,
      fillPath,
      dot: { x: x1, y: yFor(currentBalanceCents) },
    };
  }, [
    currentBalanceCents,
    daysElapsed,
    daysTotal,
    projectedEndCents,
    startBalanceCents,
  ]);

  return (
    <div className={cn("hero-cycle-trend", className)} aria-hidden>
      <p className="hero-cycle-trend__until text-right text-xs text-muted-foreground">
        Until {cycleEndLabel}
      </p>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="hero-cycle-trend__svg mt-1.5 w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6E4E91" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#6E4E91" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={chart.padX}
          y1={chart.baselineY}
          x2={chart.padX + chart.innerW}
          y2={chart.baselineY}
          stroke="#E8DFCC"
          strokeWidth="1"
        />
        <path d={chart.fillPath} fill={`url(#${fillGradientId})`} />
        <path
          d={chart.actualPath}
          fill="none"
          stroke="#6E4E91"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={chart.forecastPath}
          fill="none"
          stroke="#6E4E91"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 4"
          opacity="0.5"
        />
        <circle cx={chart.dot.x} cy={chart.dot.y} r="4" fill="#6E4E91" />
      </svg>
      <div className="hero-cycle-trend__axis mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{cycleStartLabel}</span>
        <span>{cycleEndLabel}</span>
      </div>
    </div>
  );
}

export function buildHeroCycleTrendProps(params: {
  cycleStart: Date;
  cycleEnd: Date;
  today?: Date;
  salaryCents: number;
  fixedBillsCents: number;
  savingsAllocationCents: number;
  remainingCents: number;
  pace?: FinancialPace | null;
  cycleStartLabel: string;
  cycleEndLabel: string;
}): HeroCycleTrendProps | null {
  const {
    cycleStart,
    cycleEnd,
    today = new Date(),
    salaryCents,
    fixedBillsCents,
    savingsAllocationCents,
    remainingCents,
    pace,
    cycleStartLabel,
    cycleEndLabel,
  } = params;

  if (salaryCents <= 0) return null;

  const daysTotal = Math.max(1, differenceInCalendarDays(cycleEnd, cycleStart) + 1);
  const daysElapsed = Math.min(
    daysTotal,
    Math.max(1, differenceInCalendarDays(today, cycleStart) + 1),
  );

  const startBalanceCents = Math.max(
    0,
    salaryCents - fixedBillsCents - savingsAllocationCents,
  );

  return {
    cycleStartLabel,
    cycleEndLabel,
    daysElapsed,
    daysTotal,
    startBalanceCents,
    currentBalanceCents: remainingCents,
    projectedEndCents: pace?.projectedBalanceBeforeSalaryCents ?? remainingCents,
  };
}
