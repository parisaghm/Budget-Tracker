import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  CircleCheck,
  Gauge,
  Info,
  LineChart,
  PiggyBank,
  Receipt,
  Shield,
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
import { AnimatedMoney } from "@/components/AnimatedMoney";
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
  /** Opens the adjust-savings flow when Safe to Spend is negative. */
  onAdjustSavings?: () => void;
  incomeCycle?: IncomeCycle | null;
  /** Display-only chip, e.g. "↑ 8% better than April". */
  monthComparisonLabel?: string | null;
  /** Optional adjustments applied on top of the base safe-to-spend formula. */
  rolloverBoostCents?: number;
  pausedGoalsBoostCents?: number;
  goalReallocationBoostCents?: number;
  /** Shown under the hero when a carry-over boost is active. */
  carriedOverLabel?: string | null;
  /** False until the user has saved at least one income entry for this cycle. */
  hasIncomeForCycle?: boolean;
  /** Opens income entry (Budget / SalarySetup). */
  onAddIncome?: () => void;
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
        "Your spending, savings, and bills exceed your available income this cycle.",
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
    <div className="mt-2 space-y-2 hero-health-block" role="status" aria-live="polite">
      <span key={status.level} className={cn("hero-health-pill hero-health-pill--animated", pillClass)}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden />
        {status.title}
      </span>
      <p className="hero-safe-description hero-safe-description--animated text-sm leading-relaxed text-[#746A5D]">
        {status.description}
      </p>
    </div>
  );
}

const HERO_METRIC_ACCENTS: Record<string, { bg: string; color: string }> = {
  income: { bg: "#EFE7F7", color: "#6E4E91" },
  spent: { bg: "hsl(96 22% 88%)", color: "#4A5C40" },
  saved: { bg: "hsl(3 29% 92%)", color: "#7A4542" },
  bills: { bg: "hsl(269 30% 92%)", color: "#5C4580" },
};

function WalletWarningIllustration() {
  return (
    <div className="hero-wallet-warning" aria-hidden>
      <div className="hero-wallet-warning__wallet">
        <Wallet className="hero-wallet-warning__icon" strokeWidth={1.5} />
      </div>
      <div className="hero-wallet-warning__badge">
        <AlertCircle className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function NegativeActionPanel({
  overAmountCents,
  savingsAllocationCents,
  currency,
  onAdjustSavings,
}: {
  overAmountCents: number;
  savingsAllocationCents: number;
  currency: string;
  onAdjustSavings?: () => void;
}) {
  const recommendedReductionCents = Math.min(overAmountCents, savingsAllocationCents);
  const canReduceSavings = recommendedReductionCents > 0;

  return (
    <div className="hero-action-panel" role="region" aria-label="Recommended actions to get back on track">
      <div className="hero-action-panel__main">
        <div className="hero-action-panel__alert" aria-hidden>
          <AlertCircle className="h-4 w-4 text-[#9C5A56]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-[#2B221B]">
            You&apos;re {formatMoney(overAmountCents, currency)} over your available budget this cycle.
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9C5A56]">
            Recommended
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#746A5D]">
            {canReduceSavings
              ? `Reduce this month's savings by ${formatMoney(recommendedReductionCents, currency)} to get back on track.`
              : "Review your bills and discretionary spending to get back on track."}
          </p>
          {canReduceSavings && onAdjustSavings ? (
            <button
              type="button"
              onClick={onAdjustSavings}
              className="hero-action-panel__cta mt-3 inline-flex items-center justify-center rounded-full bg-[#6E4E91] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5C4580] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6E4E91]/40"
            >
              Adjust savings
            </button>
          ) : null}
        </div>
      </div>

      <div className="hero-action-panel__divider" aria-hidden />

      <div className="hero-action-panel__options">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#746A5D]">
          Other options
        </p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link
              to="/bills"
              className="hero-action-panel__option"
            >
              <Wallet className="h-4 w-4 shrink-0 text-[#6E4E91]" aria-hidden />
              <span className="min-w-0 flex-1 text-sm font-medium text-[#2B221B]">
                Review upcoming bill
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#746A5D]/60" aria-hidden />
            </Link>
          </li>
          <li>
            <Link
              to="/expenses"
              className="hero-action-panel__option"
            >
              <Shield className="h-4 w-4 shrink-0 text-[#6E4E91]" aria-hidden />
              <span className="min-w-0 flex-1 text-sm font-medium text-[#2B221B]">
                Reduce discretionary spending
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#746A5D]/60" aria-hidden />
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

function HeroMetricCell({
  icon: Icon,
  label,
  value,
  accentKey,
  amountCents,
  currency,
  animateAmount = false,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  accentKey: keyof typeof HERO_METRIC_ACCENTS;
  amountCents?: number;
  currency?: string;
  animateAmount?: boolean;
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
        <p className="money-amount-sm mt-1 text-[0.9375rem] font-semibold leading-tight">
          {animateAmount && amountCents != null && currency ? (
            <AnimatedMoney
              cents={amountCents}
              currency={currency}
              variant="inline"
              animateOnMount={false}
              animateOnChange
              duration={220}
            />
          ) : (
            value
          )}
        </p>
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
  onAdjustSavings,
  compact = false,
  pace,
  incomeCycle = null,
  monthComparisonLabel = null,
  rolloverBoostCents = 0,
  pausedGoalsBoostCents = 0,
  goalReallocationBoostCents = 0,
  hasIncomeForCycle = salaryCents > 0,
  onAddIncome,
}: MonthPlanCardProps) {
  const isOver = hasIncomeForCycle && remainingCents < 0;
  const [negativeUiVisible, setNegativeUiVisible] = useState(isOver);
  const [negativeUiExiting, setNegativeUiExiting] = useState(false);

  useEffect(() => {
    if (isOver) {
      setNegativeUiExiting(false);
      setNegativeUiVisible(true);
      return;
    }

    if (!negativeUiVisible) return;

    setNegativeUiExiting(true);
    const timer = window.setTimeout(() => {
      setNegativeUiVisible(false);
      setNegativeUiExiting(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [isOver, negativeUiVisible]);

  const activeSavedCents = Math.max(
    0,
    savingsAllocationCents - pausedGoalsBoostCents - goalReallocationBoostCents,
  );
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
    compact && hasIncomeForCycle
      ? resolveHeroHealthStatus({
        safeToSpendCents: remainingCents,
        daysRemaining: daysLeft,
        dailyPaceCents: dailySpendingPaceCents,
        salaryCents,
      })
      : null;
  const breakdownTooltip =
    hasIncomeForCycle ? (
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

  const compactHeroMetrics = (
      <div className="hero-metric-cells">
        <HeroMetricCell
          icon={Wallet}
          label="Income this cycle"
          value={hasIncomeForCycle ? formatMoney(salaryCents, currency) : "Not entered"}
          accentKey="income"
        />
        <HeroMetricCell
          icon={TrendingUp}
          label="Spent this cycle"
          value={formatMoney(spentSoFarCents, currency)}
          accentKey="spent"
        />
        <HeroMetricCell
          icon={PiggyBank}
          label="Saved this cycle"
          value={formatMoney(activeSavedCents, currency)}
          amountCents={activeSavedCents}
          currency={currency}
          animateAmount
          accentKey="saved"
        />
        <HeroMetricCell
          icon={Receipt}
          label="Bills due"
          value={formatMoney(fixedBillsCents, currency)}
          accentKey="bills"
        />
      </div>
    );

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
          <div className="hero-safe-top">
            <div className="hero-top-left">
              <p
                id="month-plan-heading"
                className="label-caps-hero-safe flex items-center gap-2"
              >
                <span
                  className={cn(
                    "hero-status-dot inline-block h-2 w-2 shrink-0 rounded-full",
                    headerStatusDotClass,
                  )}
                  aria-hidden
                />
                Safe to spend
              </p>

              <div
                className={cn(
                  "money-hero hero-safe-amount mt-3 sm:mt-3.5",
                  isOver ? "text-foreground/90" : "text-foreground hero-safe-amount--positive",
                  "text-[clamp(2.85rem,7.5vw,4.65rem)]",
                )}
              >
                {hasIncomeForCycle ? (
                  <AnimatedMoney
                    cents={remainingCents}
                    currency={currency}
                    animateOnMount
                    animateOnChange
                    duration={220}
                  />
                ) : (
                  <span className="text-[clamp(1.75rem,5vw,2.75rem)] font-semibold tracking-tight text-foreground/80">
                    Not available
                  </span>
                )}
              </div>

              {heroHealth ? <HeroHealthBlock status={heroHealth} /> : null}

              {hasIncomeForCycle && dailyPaceCents > 0 ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-[#746A5D]">
                  <LineChart className="h-3.5 w-3.5 shrink-0 text-[#6E4E91]" aria-hidden />
                  <span className="money-display-md text-foreground">
                    {formatMoney(dailyPaceCents, currency)}
                  </span>
                  /day recommended pace
                </p>
              ) : null}

              {!hasIncomeForCycle ? (
                <div className="mt-3 space-y-3">
                  <p className="text-base font-semibold text-foreground">Add your income</p>
                  <p className="text-sm leading-relaxed text-[#746A5D]">
                    Enter the income received during this cycle to calculate your Safe to Spend.
                  </p>
                  {onAddIncome ? (
                    <button
                      type="button"
                      onClick={onAddIncome}
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Add income
                    </button>
                  ) : (
                    <Link
                      to="/budget"
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Add income
                    </Link>
                  )}
                </div>
              ) : null}
            </div>

            {negativeUiVisible ? (
              <div
                className={cn(
                  "hero-wallet-warning-wrap",
                  negativeUiExiting && "hero-wallet-warning-wrap--exiting",
                )}
              >
                <WalletWarningIllustration />
              </div>
            ) : null}
          </div>

          {negativeUiVisible && hasIncomeForCycle ? (
            <div
              className={cn(
                "hero-action-panel-wrap",
                negativeUiExiting && "hero-action-panel-wrap--exiting",
              )}
            >
              <NegativeActionPanel
                overAmountCents={Math.abs(remainingCents)}
                savingsAllocationCents={savingsAllocationCents}
                currency={currency}
                onAdjustSavings={onAdjustSavings}
              />
            </div>
          ) : null}

          {compactHeroMetrics}
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
              {hasIncomeForCycle ? (
                <HeroMoney cents={remainingCents} currency={currency} />
              ) : (
                <span className="text-[clamp(1.75rem,5vw,2.75rem)] font-semibold tracking-tight text-foreground/80">
                  Not available
                </span>
              )}
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
            {!hasIncomeForCycle ? (
              <p className="text-body-calm">
                Add your income for this cycle to see what&apos;s left to spend.
              </p>
            ) : null}
          </div>

          {hasIncomeForCycle ? (
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
