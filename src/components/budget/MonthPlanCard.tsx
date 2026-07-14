import {
  AlertCircle,
  CircleCheck,
  Gauge,
  Info,
  LineChart,
  PiggyBank,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  calculateSpentPercentage,
  formatMoney,
  formatMoneyCompact,
} from "@/utils/money";
import type { IncomeCycle } from "@/types/incomeCycle";
import {
  formatIncomeDateLabel,
  getNextIncomeDate,
  getDaysUntilNextIncome,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { getNextSalaryDateForMonth } from "@/utils/budgetPlanner";
import type { FinancialPace } from "@/utils/financialPace";
import { HeroMoney } from "@/components/budget/HeroMoney";
import { PlanSegmentBar, PlanStatTile } from "@/components/budget/PlanHeroSegments";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildSafeToSpendBreakdownLines,
  resolveSafeToSpendStatus,
} from "@/utils/safeToSpend";

export interface MonthPlanCardProps {
  currentMonth: string;
  currency: string;
  salaryCents: number;
  fixedBillsCents: number;
  savingsAllocationCents: number;
  spentSoFarCents: number;
  remainingCents: number;
  weeklySafeToSpendCents: number;
  recurringBillsCount?: number;
  onAdjust?: () => void;
  /** Home view: editorial hero with serif amount + chips, no breakdown grid. */
  compact?: boolean;
  /** Predictive pace context for the home dashboard. */
  pace?: FinancialPace;
  incomeCycle?: IncomeCycle | null;
  /** Display-only chip, e.g. "↑ 8% better than April". */
  monthComparisonLabel?: string | null;
  /** Optional adjustments applied on top of the base safe-to-spend formula. */
  rolloverBoostCents?: number;
  pausedGoalsBoostCents?: number;
  /** Shown under the hero when a carry-over boost is active. */
  carriedOverLabel?: string | null;
}

type HeroHealthLevel = "on_track" | "tight" | "action_needed";

interface HeroHealthStatus {
  level: HeroHealthLevel;
  title: string;
  description: string;
}

const HERO_HEALTH_UI: Record<
  HeroHealthLevel,
  { pillClass: string; icon: typeof CircleCheck; iconClass: string }
> = {
  on_track: {
    pillClass: "hero-health-pill--on_track",
    icon: CircleCheck,
    iconClass: "text-[#6B7F5E]",
  },
  tight: {
    pillClass: "hero-health-pill--tight",
    icon: Gauge,
    iconClass: "text-[#B07A3B]",
  },
  action_needed: {
    pillClass: "hero-health-pill--action_needed",
    icon: AlertCircle,
    iconClass: "text-[#9C5A56]",
  },
};

/** Display-only status from safe-to-spend amount and daily pace. */
function resolveHeroHealthStatus(params: {
  safeToSpendCents: number;
  daysRemaining: number;
  dailyPaceCents: number;
  salaryCents: number;
}): HeroHealthStatus | null {
  const { safeToSpendCents, daysRemaining, dailyPaceCents, salaryCents } = params;
  if (salaryCents <= 0) return null;

  const level = resolveSafeToSpendStatus(safeToSpendCents, daysRemaining, dailyPaceCents);

  if (level === "action_needed") {
    return {
      level: "action_needed",
      title: "Action needed",
      description:
        "Spending, bills, and savings exceed your income this cycle — review the breakdown above.",
    };
  }

  if (level === "tight") {
    return {
      level: "tight",
      title: "Tight this cycle",
      description: "What's left may not cover your usual daily pace until your next income date.",
    };
  }

  return {
    level: "on_track",
    title: "You are on track",
    description: "You have enough to comfortably reach your next income date at your current pace.",
  };
}

function SafeToSpendBreakdownTooltip({
  breakdown,
  currency,
}: {
  breakdown: {
    salaryCents: number;
    totalSpentCents: number;
    upcomingBillsCents: number;
    savingsAllocationCents: number;
    rolloverBoostCents?: number;
    pausedGoalsBoostCents?: number;
  };
  currency: string;
}) {
  const lines = buildSafeToSpendBreakdownLines(breakdown);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="How left in this cycle is calculated"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs space-y-2 p-3">
        <p className="text-xs font-medium text-foreground">How this is calculated</p>
        <div className="space-y-1">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-3 text-xs">
              <span
                className={
                  line.kind === "total"
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {line.kind === "deduction" ? "− " : line.kind === "total" ? "= " : ""}
                {line.label}
              </span>
              <span
                className={`money-display shrink-0 tabular-nums ${line.kind === "total" ? "font-semibold text-foreground" : "text-foreground"
                  }`}
              >
                {formatMoney(line.amountCents, currency)}
              </span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function HeroHealthBlock({ status }: { status: HeroHealthStatus }) {
  const { pillClass, icon: Icon, iconClass } = HERO_HEALTH_UI[status.level];
  return (
    <div className="mt-2" role="status" aria-live="polite">
      <span className={cn("hero-health-pill", pillClass)}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden />
        {status.title}
      </span>
    </div>
  );
}

const HERO_METRIC_ACCENTS: Record<string, { bg: string; color: string }> = {
  income: { bg: "#EFE7F7", color: "#6E4E91" },
  spent: { bg: "hsl(96 22% 88%)", color: "#4A5C40" },
  saved: { bg: "#EFE7F7", color: "#6E4E91" },
  bills: { bg: "#EFE7F7", color: "#6E4E91" },
};

function HeroMetricCell({
  icon: Icon,
  label,
  value,
  accentKey,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  accentKey: keyof typeof HERO_METRIC_ACCENTS;
}) {
  const accent = HERO_METRIC_ACCENTS[accentKey];
  return (
    <div className="hero-metric-cell">
      <div
        className="hero-metric-icon"
        style={{ backgroundColor: accent.bg, color: accent.color }}
      >
        <Icon aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-snug text-muted-foreground">{label}</p>
        <p className="money-amount-sm mt-1 text-[0.9375rem] font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function MonthPlanCard({
  currentMonth: _currentMonth,
  currency,
  salaryCents,
  fixedBillsCents,
  savingsAllocationCents,
  spentSoFarCents,
  remainingCents,
  weeklySafeToSpendCents,
  recurringBillsCount = 0,
  onAdjust,
  compact = false,
  pace,
  incomeCycle = null,
  monthComparisonLabel = null,
  rolloverBoostCents = 0,
  pausedGoalsBoostCents = 0,
}: MonthPlanCardProps) {
  const isOver = remainingCents < 0;
  const spentPct = calculateSpentPercentage(spentSoFarCents, salaryCents);
  const cycleConfigured = isIncomeCycleConfigured(incomeCycle);
  const dailyPaceCents =
    compact && pace
      ? pace.cycleDailyPaceCents
      : pace?.effectiveDailySpendCents ??
      pace?.typicalDailySpendCents ??
      (weeklySafeToSpendCents > 0 ? Math.round(weeklySafeToSpendCents / 7) : 0);
  const today = new Date();
  const nextIncomeDate = cycleConfigured
    ? getNextIncomeDate(incomeCycle, today)
    : parseISO(getNextSalaryDateForMonth(_currentMonth, incomeCycle));
  const nextIncomeLabel = formatIncomeDateLabel(nextIncomeDate);
  const daysLeft = cycleConfigured
    ? getDaysUntilNextIncome(incomeCycle, today)
    : Math.max(0, differenceInCalendarDays(nextIncomeDate, today));
  const emotionalTone = pace?.emotionalTone ?? (isOver ? "tight" : "calm");
  const dailySpendingPaceCents =
    pace?.typicalDailySpendCents ?? pace?.actualDailySpendCents ?? 0;
  const heroHealth =
    compact && salaryCents > 0
      ? resolveHeroHealthStatus({
        safeToSpendCents: remainingCents,
        daysRemaining: daysLeft,
        dailyPaceCents: dailySpendingPaceCents,
        salaryCents,
      })
      : null;
  const breakdownTooltip =
    salaryCents > 0 ? (
      <SafeToSpendBreakdownTooltip
        breakdown={{
          salaryCents,
          totalSpentCents: spentSoFarCents,
          upcomingBillsCents: fixedBillsCents,
          savingsAllocationCents,
          rolloverBoostCents,
          pausedGoalsBoostCents,
        }}
        currency={currency}
      />
    ) : null;

  const headerStatusDotClass =
    heroHealth?.level === "tight"
      ? "bg-[#B07A3B]"
      : heroHealth?.level === "action_needed"
        ? "bg-[#9C5A56]"
        : "bg-[#6B7F5E]";

  const compactHeroMetrics =
    salaryCents > 0 ? (
      <div className="hero-metric-cells">
        <HeroMetricCell
          icon={Wallet}
          label="Income"
          value={formatMoney(salaryCents, currency)}
          accentKey="income"
        />
        <HeroMetricCell
          icon={TrendingUp}
          label="Spent this month"
          value={formatMoney(spentSoFarCents, currency)}
          accentKey="spent"
        />
        <HeroMetricCell
          icon={PiggyBank}
          label="Saved this month"
          value={formatMoney(savingsAllocationCents, currency)}
          accentKey="saved"
        />
        <HeroMetricCell
          icon={Receipt}
          label="Bills due"
          value={formatMoney(fixedBillsCents, currency)}
          accentKey="bills"
        />
      </div>
    ) : null;

  return (
    <section
      className={cn(
        "card-plan animate-fade-in",
        compact ? "p-6 sm:p-8" : "p-7 sm:p-9",
        compact && "card-plan-hero card-plan-hero--compact rounded-[1.875rem] sm:rounded-[2rem]",
        compact && emotionalTone === "tight" && "card-plan-tight",
        compact && emotionalTone === "supportive" && "card-plan-supportive",
      )}
      aria-labelledby="month-plan-heading"
    >
      {compact ? (
        <>
          <div className="hero-top-grid">
            <div className="hero-top-left">
              <p
                id="month-plan-heading"
                className="label-caps-hero-safe flex items-center gap-2"
              >
                <span
                  className={cn(
                    "inline-block h-2 w-2 shrink-0 rounded-full",
                    headerStatusDotClass,
                  )}
                  aria-hidden
                />
                Safe to spend
              </p>

              <div
                className={cn(
                  "money-hero mt-3 sm:mt-4",
                  isOver ? "text-foreground/90" : "text-foreground",
                  "text-[clamp(2.85rem,7.5vw,4.65rem)]",
                )}
              >
                <HeroMoney cents={remainingCents} currency={currency} />
              </div>

              {heroHealth ? <HeroHealthBlock status={heroHealth} /> : null}

              {salaryCents > 0 && dailyPaceCents > 0 ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-[#746A5D]">
                  <LineChart className="h-3.5 w-3.5 shrink-0 text-[#6E4E91]" aria-hidden />
                  <span className="money-display-md text-foreground">
                    {formatMoney(dailyPaceCents, currency)}
                  </span>
                  /day recommended pace
                </p>
              ) : null}

              {salaryCents <= 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-[#746A5D]">
                  Add your monthly income to see what&apos;s left in this cycle.
                </p>
              ) : null}
            </div>

            {compactHeroMetrics}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <p
              id="month-plan-heading"
              className="label-caps flex items-center gap-2"
            >
              Left in this cycle · {format(nextIncomeDate, "MMM").toUpperCase()}
              {breakdownTooltip}
            </p>
            <div className="flex items-center gap-3">
              {salaryCents > 0 ? (
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {formatMoneyCompact(salaryCents, currency)} income
                </p>
              ) : null}
              {onAdjust ? (
                <button
                  type="button"
                  onClick={onAdjust}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-popover px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
                >
                  Adjust
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <div
              className={cn(
                "money-hero",
                isOver ? "text-foreground/90" : "text-foreground",
                "text-[clamp(3.25rem,8.5vw,5rem)]",
              )}
            >
              <HeroMoney cents={remainingCents} currency={currency} />
            </div>
          </div>

          <div className="mt-8 max-w-md">
            {!isOver && weeklySafeToSpendCents > 0 ? (
              <p className="text-body-calm">
                About{" "}
                <span className="money-display-md">
                  {formatMoney(weeklySafeToSpendCents, currency)}
                </span>{" "}
                per week left this month.
              </p>
            ) : null}
            {isOver ? (
              <p className="text-[15px] leading-[1.65] text-muted-foreground">
                About{" "}
                <span className="money-display-md text-foreground">
                  {formatMoney(Math.abs(remainingCents), currency)}
                </span>{" "}
                to reconcile this cycle.
              </p>
            ) : null}
            {salaryCents <= 0 ? (
              <p className="text-body-calm">
                Add your monthly income to see what&apos;s left in this cycle.
              </p>
            ) : null}
          </div>

          {salaryCents > 0 ? (
            <>
              <div className="mt-6">
                <PlanSegmentBar
                  salaryCents={salaryCents}
                  fixedBillsCents={fixedBillsCents}
                  savingsAllocationCents={savingsAllocationCents}
                  spentSoFarCents={spentSoFarCents}
                  remainingCents={Math.max(0, remainingCents)}
                  ariaLabel="Budget allocation: bills, goals, spent, and left in this cycle"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <PlanStatTile
                  label="Bills"
                  value={formatMoneyCompact(fixedBillsCents, currency)}
                  sub={recurringBillsCount > 0 ? `${recurringBillsCount} recurring` : undefined}
                  accentClass="bg-[hsl(var(--segment-bills))]"
                />
                <PlanStatTile
                  label="Goals"
                  value={formatMoneyCompact(savingsAllocationCents, currency)}
                  sub="Savings + jars"
                  accentClass="bg-[hsl(var(--segment-goals))]"
                />
                <PlanStatTile
                  label="Spent so far"
                  value={formatMoneyCompact(spentSoFarCents, currency)}
                  sub={salaryCents > 0 ? `${spentPct}% of income` : undefined}
                  accentClass="bg-[hsl(var(--segment-spent))]"
                />
                <PlanStatTile
                  label="Left in this cycle"
                  value={formatMoneyCompact(Math.max(0, remainingCents), currency)}
                  sub={`Income date ${nextIncomeLabel}`}
                  accentClass="bg-[hsl(var(--segment-safe))]"
                />
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
