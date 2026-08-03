import { Link } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  Flag,
  PiggyBank,
  ReceiptText,
  TrendingDown,
  Wallet,
} from "lucide-react";
import type { OverspendDecisionContext } from "@/hooks/useOverspendDecision";
import { overspendActions, useOverspendDecision } from "@/hooks/useOverspendDecision";
import type { PaceSupportDecisionContext } from "@/hooks/usePaceSupportDecision";
import { usePaceSupportDecision } from "@/hooks/usePaceSupportDecision";
import type { SavingsGoal } from "@/types/finance";
import type { FinancialPace } from "@/utils/financialPace";
import { formatMoney, formatMonthNameOnly } from "@/utils/money";
import { useRolloverDecision } from "@/hooks/useRolloverDecision";
import { BudgetActionConfirmDialog } from "@/components/budget/BudgetActionConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateGoalPlan } from "@/utils/goalPlan";

export type NextStepKind =
  | "setup_budget"
  | "handle_rollover"
  | "handle_overspend"
  | "pace_support"
  | "review_bills"
  | "weekly_review"
  | "on_track";

export interface NextStep {
  kind: NextStepKind;
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
  /** Calm action rows for pace-aware guidance. */
  paceActions?: FinancialPace["suggestedActions"];
}

export interface RolloverNextStepContext {
  userId: string;
  month: string;
  leftoverCents: number;
  monthlyIncomeCents: number;
  currency: string;
  previousMonthKey: string;
  goals: SavingsGoal[];
  onContribution: (goalId: string, amountCents: number) => Promise<void> | void;
  onDecided: () => void;
}

interface NextStepCardProps {
  step: NextStep;
  rolloverContext?: RolloverNextStepContext;
  overspendContext?: OverspendDecisionContext;
  paceSupportContext?: PaceSupportDecisionContext;
}

const icons: Record<NextStepKind, typeof Wallet> = {
  setup_budget: Wallet,
  handle_rollover: Wallet,
  handle_overspend: Wallet,
  pace_support: Wallet,
  review_bills: ReceiptText,
  weekly_review: Calendar,
  on_track: PiggyBank,
};

const actionLabels: Record<Exclude<NextStepKind, "handle_rollover" | "pace_support">, string> = {
  setup_budget: "Add monthly income",
  handle_overspend: "See calm options",
  review_bills: "View upcoming bills",
  weekly_review: "Open cycle review",
  on_track: "Open budget",
};

const actionHints: Record<Exclude<NextStepKind, "handle_rollover" | "pace_support">, string> = {
  setup_budget: "Shows what's left in this cycle",
  handle_overspend: "No judgment, just a path forward",
  review_bills: "Plan around what's due",
  weekly_review: "Progress and reflection",
  on_track: "Continue your plan",
};

const rolloverActions = [
  {
    id: "add_to_budget" as const,
    label: "Carry into this month",
    hint: "Adds the leftover money to this month's available budget.",
    icon: Wallet,
    suggested: true,
  },
  {
    id: "move_to_savings" as const,
    label: "Move to savings",
    hint: "Moves the leftover money into savings.",
    icon: PiggyBank,
    suggested: false,
  },
  {
    id: "add_to_goal" as const,
    label: "Add to a goal",
    hint: "Use the leftover money for one of your savings goals.",
    icon: Flag,
    suggested: false,
  },
];

export function resolveNextStep(params: {
  hasBudget: boolean;
  showRollover: boolean;
  showOverspend: boolean;
  upcomingBillsCount: number;
  leftUntilPaydayCents: number;
  currency: string;
  leftoverCents?: number;
  previousMonthKey?: string;
  pace?: FinancialPace;
}): NextStep {
  const {
    hasBudget,
    showRollover,
    showOverspend,
    upcomingBillsCount,
    leftUntilPaydayCents,
    currency,
    leftoverCents = 0,
    previousMonthKey = "",
    pace,
  } = params;

  if (!hasBudget) {
    return {
      kind: "setup_budget",
      title: "Set up this month",
      description: "Add your monthly income so we can show what's left in this cycle and a gentle pace.",
      actionLabel: "Open budget",
      actionTo: "/budget",
    };
  }

  if (pace?.mayRunShort) {
    return {
      kind: "pace_support",
      title: "You may need support before your income date",
      description:
        "Based on your current pace and upcoming bills, you may run short before your income date.",
      actionLabel: "See options",
      actionTo: "#next-step",
      paceActions: pace.suggestedActions,
    };
  }

  if (showOverspend) {
    return {
      kind: "handle_overspend",
      title: "A small adjustment can help",
      description: "Choose one of these options to stay on track.",
      actionLabel: "See options",
      actionTo: "#next-step",
    };
  }

  if (showRollover) {
    const previousMonthName = previousMonthKey
      ? formatMonthNameOnly(previousMonthKey)
      : "last month";
    return {
      kind: "handle_rollover",
      title: `Use last month's leftover, ${formatMoney(leftoverCents, currency)}`,
      description: `You have ${formatMoney(leftoverCents, currency)} left from ${previousMonthName}. Pick what to do with it.`,
      actionLabel: "See options",
      actionTo: "#next-step",
    };
  }

  return {
    kind: "on_track",
    title: "You're on track",
    description: "No urgent action needed right now.",
    actionLabel: "View budget",
    actionTo: "/budget",
  };
}

interface ActionRowProps {
  to?: string;
  isAnchor?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  icon: typeof Wallet;
  title: string;
  hint: string;
  suggested?: boolean;
}

const nextStepSectionClass =
  "card-next-step dashboard-card-hover w-full scroll-mt-24 rounded-[1.5rem] p-5 outline-none lg:rounded-[1.875rem] lg:p-7";

function ActionRow({
  to,
  isAnchor,
  onClick,
  disabled,
  icon: Icon,
  title,
  hint,
  suggested,
}: ActionRowProps) {
  const content = (
    <>
      <div className="card-next-step-icon">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[#1A1411]">{title}</p>
          {suggested ? <span className="badge-next-step-suggested">Suggested</span> : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight
        className="card-next-step-action-chevron h-4 w-4 shrink-0 text-[#6E4E91]/45"
        aria-hidden
      />
    </>
  );

  const baseClass =
    "card-next-step-action group disabled:pointer-events-none disabled:opacity-60";

  if (onClick) {
    return (
      <button type="button" className={baseClass} onClick={onClick} disabled={disabled}>
        {content}
      </button>
    );
  }

  if (isAnchor && to) {
    return (
      <a href={to} className={baseClass}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to ?? "/"} className={baseClass}>
      {content}
    </Link>
  );
}

function RolloverNextStepBody({
  step,
  context,
}: {
  step: NextStep;
  context: RolloverNextStepContext;
}) {
  const {
    activeGoals,
    selectedGoalId,
    setSelectedGoalId,
    isSaving,
    pending,
    setPending,
    requestChoice,
    applyChoice,
    startGoalChoice,
  } = useRolloverDecision({
    userId: context.userId,
    month: context.month,
    leftoverCents: context.leftoverCents,
    monthlyIncomeCents: context.monthlyIncomeCents,
    currency: context.currency,
    goals: context.goals,
    onContribution: context.onContribution,
    onDecided: context.onDecided,
  });

  const showGoalPicker = activeGoals.length > 1;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p id="next-step-heading" className="label-caps-next-step">
          Next step
        </p>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => requestChoice("ignore")}
          className="link-next-step-muted disabled:opacity-60"
        >
          Later
        </button>
      </div>

      <h3 className="mt-3 break-words text-lg font-semibold leading-snug tracking-[-0.015em] text-[#1A1411] sm:text-xl">
        {step.title}
      </h3>
      <p className="mt-3 text-sm leading-[1.65] text-muted-foreground">{step.description}</p>

      {showGoalPicker ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">Choose a goal for &quot;Add to a goal&quot;</p>
          <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
            <SelectTrigger className="h-10 rounded-xl border-border/60 bg-popover/80">
              <SelectValue placeholder="Choose a goal" />
            </SelectTrigger>
            <SelectContent>
              {activeGoals.map((goal) => (
                <SelectItem key={goal.id} value={goal.id}>
                  {goal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="mt-5 space-y-2 sm:mt-6">
        {rolloverActions.map(({ id, label, hint, icon, suggested }) => (
          <ActionRow
            key={id}
            icon={icon}
            title={label}
            hint={hint}
            suggested={suggested}
            disabled={isSaving}
            onClick={() => {
              if (id === "add_to_goal") {
                startGoalChoice();
              } else {
                requestChoice(id);
              }
            }}
          />
        ))}
      </div>

      <BudgetActionConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        confirmLabel={pending?.choice === "add_to_budget" ? "Carry into this cycle" : "Apply"}
        isConfirming={isSaving}
        onConfirm={() => pending && void applyChoice(pending.choice)}
      />
    </>
  );
}

const paceSupportActions = [
  {
    id: "move_from_savings" as const,
    label: "Move money from savings",
    hint: "Use what you have set aside — only if it feels right.",
    icon: PiggyBank,
    suggested: false,
  },
  {
    id: "pause_goal" as const,
    label: "Pause a goal temporarily",
    hint: "Free up room this month without giving up the goal.",
    icon: Flag,
    suggested: false,
  },
  {
    id: "reduce_daily_pace" as const,
    label: "Reduce daily pace",
    hint: "Spread what's left gently across the days until your income date.",
    icon: TrendingDown,
    suggested: true,
  },
];

function PaceSupportNextStepBody({
  step,
  context,
}: {
  step: NextStep;
  context: PaceSupportDecisionContext;
}) {
  const {
    isSaving,
    pending,
    setPending,
    savingsAmount,
    setSavingsAmount,
    savingsAmountCents,
    savingsAmountError,
    canConfirmMoveSavings,
    selectedGoalId,
    setSelectedGoalId,
    selectedSavingsGoalId,
    setSelectedSavingsGoalId,
    movableGoals,
    pausableGoals,
    maxMoveCents,
    recommendedDailyCents,
    currencySymbol,
    openMoveSavings,
    openPauseGoal,
    openReducePace,
    applyMoveSavings,
    applyPauseGoal,
    applyReducePace,
  } = usePaceSupportDecision(context);

  const selectedMovableGoal = movableGoals.find((s) => s.goal.id === selectedSavingsGoalId);

  const handleAction = (id: (typeof paceSupportActions)[number]["id"]) => {
    if (id === "move_from_savings") openMoveSavings();
    else if (id === "pause_goal") openPauseGoal();
    else openReducePace();
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p id="next-step-heading" className="label-caps-next-step">
          Next step
        </p>
      </div>

      <h3 className="mt-3 break-words text-lg font-semibold leading-snug tracking-[-0.015em] text-[#1A1411] sm:text-xl">
        {step.title}
      </h3>
      <p className="mt-3 text-sm leading-[1.65] text-muted-foreground">{step.description}</p>

      <div className="mt-5 space-y-2 sm:mt-6">
        {paceSupportActions.map(({ id, label, hint, icon, suggested }) => (
          <ActionRow
            key={id}
            icon={icon}
            title={label}
            hint={
              id === "move_from_savings" && movableGoals.length === 0
                ? "No savings or goals with allocation left this cycle"
                : id === "pause_goal" && pausableGoals.length === 0
                ? "No active goals with a monthly amount this month"
                : id === "reduce_daily_pace"
                  ? `Aim closer to ${formatMoney(recommendedDailyCents, context.currency)} per day until your income date.`
                  : hint
            }
            suggested={suggested}
            disabled={
              isSaving ||
              (id === "move_from_savings" && movableGoals.length === 0) ||
              (id === "pause_goal" && pausableGoals.length === 0)
            }
            onClick={() => handleAction(id)}
          />
        ))}
      </div>

      <Dialog
        open={pending?.kind === "move_savings"}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
      >
        <DialogContent className="sm:max-w-md sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Move money from savings</DialogTitle>
            <DialogDescription>
              Use part of what you planned to save this cycle — not a bank withdrawal. Pick a goal
              and amount to add back to what&apos;s left in this cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {movableGoals.length > 1 ? (
              <div className="grid gap-2">
                <Label>Savings / goal to reduce</Label>
                <Select
                  value={selectedSavingsGoalId}
                  onValueChange={(id) => {
                    setSelectedSavingsGoalId(id);
                    setSavingsAmount("");
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl border-border/60 bg-popover/80">
                    <SelectValue placeholder="Choose a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {movableGoals.map(({ goal, availableCents }) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.name} ({formatMoney(availableCents, context.currency)} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : selectedMovableGoal ? (
              <p className="text-sm text-muted-foreground">
                From &quot;{selectedMovableGoal.goal.name}&quot; —{" "}
                {formatMoney(selectedMovableGoal.availableCents, context.currency)} available this
                cycle
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="pace-savings-amount">Amount ({currencySymbol})</Label>
              <Input
                id="pace-savings-amount"
                type="number"
                min="0"
                step="0.01"
                max={maxMoveCents > 0 ? maxMoveCents / 100 : undefined}
                value={savingsAmount}
                onChange={(e) => setSavingsAmount(e.target.value)}
                autoFocus
              />
              {maxMoveCents > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Up to {formatMoney(maxMoveCents, context.currency)} available
                </p>
              ) : null}
              {savingsAmountError ? (
                <p className="text-xs text-destructive">{savingsAmountError}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              disabled={isSaving || !canConfirmMoveSavings}
              onClick={() => void applyMoveSavings()}
            >
              {isSaving ? "Applying…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pending?.kind === "pause_goal"}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
      >
        <DialogContent className="sm:max-w-md sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Pause a goal temporarily</DialogTitle>
            <DialogDescription>
              This month&apos;s planned amount for the goal returns to your spending room. The goal
              stays on your list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {pausableGoals.length > 1 ? (
              <div className="grid gap-2">
                <Label>Goal to pause</Label>
                <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                  <SelectTrigger className="h-10 rounded-xl border-border/60 bg-popover/80">
                    <SelectValue placeholder="Choose a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {pausableGoals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : pausableGoals[0] ? (
              <p className="text-sm text-muted-foreground">
                Pause &quot;{pausableGoals[0].name}&quot; (
                {formatMoney(
                  calculateGoalPlan(pausableGoals[0]).monthlyRequiredSavingCents,
                  context.currency,
                )}{" "}
                this month)?
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              disabled={isSaving || !selectedGoalId}
              onClick={() => void applyPauseGoal()}
            >
              {isSaving ? "Applying…" : "Pause for this month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BudgetActionConfirmDialog
        open={pending?.kind === "reduce_pace"}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
        title={pending?.kind === "reduce_pace" ? pending.title : ""}
        description={pending?.kind === "reduce_pace" ? pending.description : ""}
        isConfirming={isSaving}
        onConfirm={() => void applyReducePace()}
      />
    </>
  );
}

function OverspendNextStepBody({
  step,
  context,
}: {
  step: NextStep;
  context: OverspendDecisionContext;
}) {
  const { isSaving, pending, setPending, canUseLeftover, requestChoice, applyChoice } =
    useOverspendDecision(context);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p id="next-step-heading" className="label-caps-next-step">
          Next step
        </p>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => requestChoice("ignore")}
          className="link-next-step-muted disabled:opacity-60"
        >
          Later
        </button>
      </div>

      <h3 className="mt-3 break-words text-lg font-semibold leading-snug tracking-[-0.015em] text-[#1A1411] sm:text-xl">
        {step.title}
      </h3>
      <p className="mt-3 text-sm leading-[1.65] text-muted-foreground">{step.description}</p>

      <div className="mt-5 space-y-2 sm:mt-6">
        {overspendActions.map(({ id, label, hint, suggested }) => (
          <ActionRow
            key={id}
            icon={TrendingDown}
            title={label}
            hint={
              id === "use_leftover" && !canUseLeftover
                ? "No leftover available from last month"
                : hint
            }
            suggested={suggested}
            disabled={isSaving || (id === "use_leftover" && !canUseLeftover)}
            onClick={() => requestChoice(id)}
          />
        ))}
      </div>

      <BudgetActionConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
        title={pending?.title ?? ""}
        description={pending?.description ?? ""}
        isConfirming={isSaving}
        onConfirm={() => pending && void applyChoice(pending.choice)}
      />
    </>
  );
}

export function NextStepCard({
  step,
  rolloverContext,
  overspendContext,
  paceSupportContext,
}: NextStepCardProps) {
  const Icon = icons[step.kind];
  const isAnchor = step.actionTo.startsWith("#");
  const isOnTrack = step.kind === "on_track";
  const isPaceSupport = step.kind === "pace_support" && paceSupportContext;
  const isRollover = step.kind === "handle_rollover" && rolloverContext;
  const isOverspend = step.kind === "handle_overspend" && overspendContext;

  if (isPaceSupport) {
    return (
      <section
        id="next-step"
        tabIndex={-1}
        className={nextStepSectionClass}
        aria-labelledby="next-step-heading"
      >
        <PaceSupportNextStepBody step={step} context={paceSupportContext} />
      </section>
    );
  }

  if (isRollover) {
    return (
      <section
        id="next-step"
        tabIndex={-1}
        className={nextStepSectionClass}
        aria-labelledby="next-step-heading"
      >
        <RolloverNextStepBody step={step} context={rolloverContext} />
      </section>
    );
  }

  if (isOverspend) {
    return (
      <section
        id="next-step"
        tabIndex={-1}
        className={nextStepSectionClass}
        aria-labelledby="next-step-heading"
      >
        <OverspendNextStepBody step={step} context={overspendContext} />
      </section>
    );
  }

  return (
    <section
      id="next-step"
      tabIndex={-1}
      className={nextStepSectionClass}
      aria-labelledby="next-step-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <p id="next-step-heading" className="label-caps-next-step">
          Next step
        </p>
        {isAnchor ? (
          <a href={step.actionTo} className="link-next-step-muted">
            Later
          </a>
        ) : null}
      </div>

      <h3 className="mt-3 break-words text-lg font-semibold leading-snug tracking-[-0.015em] text-[#1A1411] sm:text-xl">
        {step.title}
      </h3>
      <p className="mt-3 text-sm leading-[1.65] text-muted-foreground">{step.description}</p>

      <div className="mt-5 sm:mt-6">
        {isOnTrack ? (
          <Link
            to={step.actionTo}
            className="btn-next-step-primary"
          >
            {step.actionLabel}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <ActionRow
            to={step.actionTo}
            isAnchor={isAnchor}
            icon={Icon}
            title={
              actionLabels[step.kind as Exclude<NextStepKind, "handle_rollover" | "pace_support">]
            }
            hint={
              actionHints[step.kind as Exclude<NextStepKind, "handle_rollover" | "pace_support">]
            }
            suggested={!isAnchor}
          />
        )}
      </div>
    </section>
  );
}
