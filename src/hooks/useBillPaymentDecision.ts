import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { RecurringBill, SavingsGoal } from "@/types/finance";
import {
  applyBudgetPlanChange,
  getMonthAdjustments,
  setMonthAdjustments,
} from "@/utils/budgetDecisions";
import {
  billPaymentFundingShortfallCents,
  isBillReservedInUpcoming,
  logBillPaymentDebug,
  needsFundingBeforeBillPayment,
  projectSafeToSpendAfterBillPayment,
} from "@/utils/billPayment";
import { calculateGoalPlan } from "@/utils/goalPlan";
import { eurosToCents, formatMoney, getCurrencySymbol } from "@/utils/money";
import { getMovableGoalSources } from "@/utils/paceSupport";
import { showBudgetUpdatedToast } from "@/utils/budgetActionToast";

export interface BillPaymentContext {
  userId: string;
  month: string;
  currency: string;
  safeToSpendCents: number;
  upcomingBills: RecurringBill[];
  totalSpentCents: number;
  savingsGoals: SavingsGoal[];
  markRecurringBillPaid: (billId: string) => Promise<void>;
  onAdjustmentsChanged: () => void;
}

type PendingModal =
  | { kind: "funding"; bill: RecurringBill; wasBillReserved: boolean }
  | { kind: "move_savings"; bill: RecurringBill; wasBillReserved: boolean }
  | { kind: "pause_goal"; bill: RecurringBill; wasBillReserved: boolean };

export function useBillPaymentDecision(context: BillPaymentContext) {
  const {
    userId,
    month,
    currency,
    safeToSpendCents,
    upcomingBills,
    totalSpentCents,
    savingsGoals,
    markRecurringBillPaid,
    onAdjustmentsChanged,
  } = context;

  const [isSaving, setIsSaving] = useState(false);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingModal | null>(null);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [selectedSavingsGoalId, setSelectedSavingsGoalId] = useState("");

  const adjustments = getMonthAdjustments(userId, month);
  const pausedSet = useMemo(() => new Set(adjustments.pausedGoalIds), [adjustments.pausedGoalIds]);

  const movableGoals = useMemo(
    () => getMovableGoalSources(savingsGoals, adjustments.pausedGoalIds, adjustments.goalReallocationCents),
    [adjustments.goalReallocationCents, adjustments.pausedGoalIds, savingsGoals],
  );

  const pausableGoals = useMemo(
    () =>
      savingsGoals.filter((goal) => {
        if (pausedSet.has(goal.id)) return false;
        return calculateGoalPlan(goal).monthlyRequiredSavingCents > 0;
      }),
    [pausedSet, savingsGoals],
  );

  const selectedMovableGoal = movableGoals.find((s) => s.goal.id === selectedSavingsGoalId);
  const maxMoveCents = selectedMovableGoal?.availableCents ?? 0;

  const executePayment = async (bill: RecurringBill, wasBillReserved: boolean) => {
    const safeToSpendBefore = safeToSpendCents;
    const expensesBefore = totalSpentCents;

    logBillPaymentDebug({
      billId: bill.id,
      billName: bill.name,
      billAmountCents: bill.amountCents,
      wasBillReserved,
      safeToSpendBefore,
      safeToSpendAfter: projectSafeToSpendAfterBillPayment(
        safeToSpendBefore,
        bill.amountCents,
        wasBillReserved,
      ),
      paid: false,
      expensesTotalAfter: expensesBefore,
    });

    setPayingBillId(bill.id);
    try {
      await markRecurringBillPaid(bill.id);
      logBillPaymentDebug({
        billId: bill.id,
        billName: bill.name,
        billAmountCents: bill.amountCents,
        wasBillReserved,
        safeToSpendBefore,
        safeToSpendAfter: projectSafeToSpendAfterBillPayment(
          safeToSpendBefore,
          bill.amountCents,
          wasBillReserved,
        ),
        paid: true,
        expensesTotalAfter: expensesBefore + bill.amountCents,
      });
      toast.success(`${bill.name} marked as paid`);
      setPending(null);
    } catch (error) {
      toast.error("Could not mark bill as paid", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
      throw error;
    } finally {
      setPayingBillId(null);
    }
  };

  const requestMarkPaid = async (bill: RecurringBill) => {
    const wasBillReserved = isBillReservedInUpcoming(bill, upcomingBills);
    if (
      needsFundingBeforeBillPayment(safeToSpendCents, bill.amountCents, wasBillReserved)
    ) {
      setPending({ kind: "funding", bill, wasBillReserved });
      return;
    }
    await executePayment(bill, wasBillReserved);
  };

  const tryPayAfterFunding = async (
    bill: RecurringBill,
    wasBillReserved: boolean,
    safeToSpendBoostCents: number,
  ) => {
    const latestSafeToSpend = safeToSpendCents + safeToSpendBoostCents;
    if (
      needsFundingBeforeBillPayment(latestSafeToSpend, bill.amountCents, wasBillReserved)
    ) {
      return;
    }
    await executePayment(bill, wasBillReserved);
  };

  const openMoveSavings = (bill: RecurringBill, wasBillReserved: boolean) => {
    if (movableGoals.length === 0) return;
    setSavingsAmount("");
    setSelectedSavingsGoalId(movableGoals[0]?.goal.id ?? "");
    setPending({ kind: "move_savings", bill, wasBillReserved });
  };

  const openPauseGoal = (bill: RecurringBill, wasBillReserved: boolean) => {
    if (pausableGoals.length === 0) return;
    setSelectedGoalId(pausableGoals[0]?.id ?? "");
    setPending({ kind: "pause_goal", bill, wasBillReserved });
  };

  const applyMoveSavings = async () => {
    const bill = pending?.bill;
    const wasBillReserved = pending?.wasBillReserved ?? false;
    if (!bill) return;

    const source = movableGoals.find((s) => s.goal.id === selectedSavingsGoalId);
    if (!source) return;

    const value = parseFloat(savingsAmount);
    if (isNaN(value) || value <= 0) return;

    const amountCents = eurosToCents(value);
    if (amountCents > source.availableCents) return;

    const shortfall = billPaymentFundingShortfallCents(
      safeToSpendCents,
      bill.amountCents,
      wasBillReserved,
    );
    if (shortfall > 0 && amountCents < shortfall) {
      toast.error(`Move at least ${formatMoney(shortfall, currency)} to cover this bill.`);
      return;
    }

    const prev = getMonthAdjustments(userId, month);
    const before = safeToSpendCents;
    const after = before + amountCents;

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_move_from_savings",
          label: `Move from savings for bill: ${bill.name}`,
          amountCents,
          oldValueCents: before,
          newValueCents: after,
        },
        () => {
          const prevRealloc = prev.goalReallocationCents[source.goal.id] ?? 0;
          setMonthAdjustments(userId, month, {
            goalReallocationCents: {
              ...prev.goalReallocationCents,
              [source.goal.id]: prevRealloc + amountCents,
            },
          });
        },
      );
      showBudgetUpdatedToast(
        userId,
        month,
        `Moved ${formatMoney(amountCents, currency)} from "${source.goal.name}" back into this cycle.`,
        onAdjustmentsChanged,
      );
      onAdjustmentsChanged();
      setPending(null);
      await tryPayAfterFunding(bill, wasBillReserved, amountCents);
    } finally {
      setIsSaving(false);
    }
  };

  const applyPauseGoal = async () => {
    const bill = pending?.bill;
    const wasBillReserved = pending?.wasBillReserved ?? false;
    if (!bill) return;

    const goal = pausableGoals.find((g) => g.id === selectedGoalId);
    if (!goal) return;

    const freedCents = calculateGoalPlan(goal).monthlyRequiredSavingCents;
    const prev = getMonthAdjustments(userId, month);
    if (prev.pausedGoalIds.includes(goal.id)) return;

    const shortfall = billPaymentFundingShortfallCents(
      safeToSpendCents,
      bill.amountCents,
      wasBillReserved,
    );
    if (shortfall > 0 && freedCents < shortfall) {
      toast.error(`This goal frees ${formatMoney(freedCents, currency)} — not enough for the bill.`);
      return;
    }

    const before = safeToSpendCents;
    const after = before + freedCents;

    setIsSaving(true);
    try {
      applyBudgetPlanChange(
        userId,
        month,
        {
          actionType: "pace_pause_goal",
          label: `Pause goal for bill: ${goal.name}`,
          amountCents: freedCents,
          oldValueCents: before,
          newValueCents: after,
        },
        () => {
          setMonthAdjustments(userId, month, {
            pausedGoalIds: [...prev.pausedGoalIds, goal.id],
          });
        },
      );
      showBudgetUpdatedToast(
        userId,
        month,
        `Paused "${goal.name}" this month — ${formatMoney(freedCents, currency)} returned to your spending room.`,
        onAdjustmentsChanged,
      );
      onAdjustmentsChanged();
      setPending(null);
      await tryPayAfterFunding(bill, wasBillReserved, freedCents);
    } finally {
      setIsSaving(false);
    }
  };

  const savingsAmountCents = (() => {
    const value = parseFloat(savingsAmount);
    if (isNaN(value) || value <= 0) return 0;
    return eurosToCents(value);
  })();

  const savingsAmountError =
    savingsAmountCents > 0 && maxMoveCents > 0 && savingsAmountCents > maxMoveCents
      ? `Maximum available from this goal: ${formatMoney(maxMoveCents, currency)}`
      : savingsAmountCents > 0 && maxMoveCents <= 0
        ? "No allocation left to move from this goal"
        : null;

  const fundingShortfallCents =
    pending?.bill && pending.wasBillReserved != null
      ? billPaymentFundingShortfallCents(
          safeToSpendCents,
          pending.bill.amountCents,
          pending.wasBillReserved,
        )
      : 0;

  const canConfirmMoveSavings =
    savingsAmountCents > 0 &&
    savingsAmountCents <= maxMoveCents &&
    !!selectedSavingsGoalId &&
    (fundingShortfallCents <= 0 || savingsAmountCents >= fundingShortfallCents);

  return {
    isSaving,
    payingBillId,
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
    selectedMovableGoal,
    maxMoveCents,
    fundingShortfallCents,
    currencySymbol: getCurrencySymbol(currency),
    requestMarkPaid,
    openMoveSavings,
    openPauseGoal,
    applyMoveSavings,
    applyPauseGoal,
  };
}
