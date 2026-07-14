import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Calendar, List, Pencil, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { RecurringBill } from "@/types/finance";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { useBillPaymentDecision } from "@/hooks/useBillPaymentDecision";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { BillPaymentModals } from "@/components/BillPaymentModals";
import { formatMoney } from "@/utils/money";
import {
  BILL_FREQUENCY_OPTIONS,
  formatBillDueDateLabel,
  formatBillSeriesSummary,
  getDaysUntil,
  isBillSeriesActive,
} from "@/utils/recurringBills";
import { getPausedGoalsAllocationCents, getGoalReallocationBoostCents } from "@/utils/paceSupport";
import { computeSafeToSpendCents } from "@/utils/safeToSpend";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { RecurringBillForm } from "@/components/RecurringBillForm";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";

type ViewMode = "list" | "calendar";

const frequencyLabelMap = Object.fromEntries(BILL_FREQUENCY_OPTIONS.map((it) => [it.value, it.label])) as Record<string, string>;

export default function BillsPage() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const {
    recurringBills,
    allCategories,
    budget,
    addRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    markRecurringBillPaid,
    addExpense,
    currentMonth,
    upcomingBills,
    upcomingUnpaidBillsCents,
    totalSpentCents,
    savingsGoalAllocationCents,
    savingsGoals,
  } = useSupabaseFinanceData();
  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments, refresh } = useBudgetAdjustments(userId || undefined, currentMonth);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringBill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sortedBills = useMemo(
    () => [...recurringBills].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)),
    [recurringBills],
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, RecurringBill[]>();
    sortedBills.forEach((bill) => {
      const key = bill.nextDueDate;
      map.set(key, [...(map.get(key) ?? []), bill]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sortedBills]);

  const activeCurrency = budget?.currency ?? "EUR";
  const pausedGoalsBoostCents = getPausedGoalsAllocationCents(
    savingsGoals,
    adjustments.pausedGoalIds,
  );
  const goalReallocationBoostCents = getGoalReallocationBoostCents(adjustments.goalReallocationCents);
  const adjustedSafeToSpend = computeSafeToSpendCents({
    incomeForCurrentCycleCents: budget?.salaryCents ?? 0,
    spentSoFarCents: totalSpentCents,
    upcomingBillsBeforeIncomeDateCents: upcomingUnpaidBillsCents,
    savingsGoalsForCurrentCycleCents: savingsGoalAllocationCents,
    rolloverBoostCents: adjustments.rolloverBoostCents,
    pausedGoalsBoostCents,
    goalReallocationBoostCents,
  });
  const billPayment = useBillPaymentDecision({
    userId: userId || "",
    month: currentMonth,
    currency: activeCurrency,
    safeToSpendCents: adjustedSafeToSpend,
    upcomingBills,
    totalSpentCents,
    savingsGoals,
    markRecurringBillPaid,
    onAdjustmentsChanged: refresh,
  });

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteRecurringBill(deleteTarget.id);
      toast.success("Bill deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error("Could not delete bill", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddOrUpdate = async (payload: Parameters<typeof addRecurringBill>[0]) => {
    try {
      if (editingBill) {
        await updateRecurringBill(editingBill.id, payload);
        toast.success("Bill updated");
      } else {
        await addRecurringBill(payload);
        toast.success("Bill added");
      }
    } catch (error) {
      toast.error("Could not save bill", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setEditingBill(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Recurring Bills</title>
      </Helmet>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur-xl">
          <div className="container flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md shadow-primary/15 sm:h-12 sm:w-12 sm:shadow-lg sm:shadow-primary/20"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Wallet className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-foreground sm:text-xl">Recurring bills</h1>
                <p className="text-xs text-muted-foreground sm:text-xs">Regular payments in one calm list</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Link
                to="/dashboard"
                className="btn-secondary touch-hit order-2 min-h-11 w-full justify-center text-sm sm:order-1 sm:w-auto sm:text-xs"
              >
                Dashboard
              </Link>
              <Button
                type="button"
                onClick={() => {
                  setEditingBill(null);
                  setIsFormOpen(true);
                }}
                className="touch-hit order-1 h-12 w-full gap-2 sm:order-2 sm:h-10 sm:w-auto"
              >
                <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
                Add bill
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 pr-mobile-fab pt-5 sm:px-6 sm:pt-8 md:pr-6 lg:px-8">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              className="touch-hit h-12 flex-1 gap-2 sm:h-10 sm:flex-none"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              type="button"
              variant={viewMode === "calendar" ? "default" : "outline"}
              onClick={() => setViewMode("calendar")}
              className="touch-hit h-12 flex-1 gap-2 sm:h-10 sm:flex-none"
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </Button>
          </div>

          {sortedBills.length === 0 ? (
            <div className="card-elevated p-8 text-center">
              <h2 className="text-lg font-semibold mb-2">No recurring bills yet</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Add rent, subscriptions, or other regular payments so your budget knows what is coming.
              </p>
              <Button type="button" onClick={() => setIsFormOpen(true)}>Add your first bill</Button>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-3">
              {sortedBills.map((bill) => (
                <div
                  key={bill.id}
                  className="card-elevated flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">{bill.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatBillDueDateLabel(bill.nextDueDate, "MMM d, yyyy")} · {frequencyLabelMap[bill.frequency]} · {bill.status}
                    </p>
                    {formatBillSeriesSummary(bill) ? (
                      <p className="mt-1 text-xs text-muted-foreground">{formatBillSeriesSummary(bill)}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isBillSeriesActive(bill)
                        ? `Due in ${Math.max(0, getDaysUntil(bill.nextDueDate))} day${Math.max(0, getDaysUntil(bill.nextDueDate)) === 1 ? "" : "s"}`
                        : "Series complete"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <span className="money-display text-lg font-bold sm:mr-1 sm:text-base">
                      {formatMoney(bill.amountCents, activeCurrency)}
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    {isBillSeriesActive(bill) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-12 w-full touch-manipulation sm:h-9 sm:w-auto"
                        disabled={billPayment.payingBillId === bill.id}
                        onClick={() => void billPayment.requestMarkPaid(bill)}
                      >
                        {billPayment.payingBillId === bill.id ? "Saving…" : "Mark as paid"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full touch-manipulation sm:h-9 sm:w-auto"
                      onClick={() => {
                        setEditingBill(bill);
                        setIsFormOpen(true);
                      }}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-12 w-full touch-manipulation sm:h-9 sm:w-auto"
                      onClick={() => setDeleteTarget(bill)}
                    >
                      Delete
                    </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(([date, bills]) => (
                <div key={date} className="card-elevated p-4">
                  <h3 className="font-semibold mb-3">{formatBillDueDateLabel(date, "EEEE, MMM d")}</h3>
                  <div className="space-y-2">
                    {bills.map((bill) => (
                      <div key={bill.id} className="rounded-lg bg-muted px-3 py-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{bill.name}</p>
                          <p className="text-xs text-muted-foreground">{frequencyLabelMap[bill.frequency]} · {bill.status}</p>
                        </div>
                        <span className="font-semibold money-display text-sm">{formatMoney(bill.amountCents, activeCurrency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <QuickAddExpenseSheet
        currency={activeCurrency}
        categories={allCategories}
        budgetMonth={currentMonth}
        onAdd={addExpense}
      />
      <MobileBottomNav />
      <RecurringBillForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingBill(null);
        }}
        categories={allCategories}
        currency={activeCurrency}
        editingBill={editingBill}
        onSubmit={handleAddOrUpdate}
      />
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
        title="Delete bill?"
        description="This removes the recurring bill permanently. This action cannot be undone."
        detail={
          deleteTarget ? (
            <>
              {deleteTarget.name} · {formatMoney(deleteTarget.amountCents, activeCurrency)}
            </>
          ) : undefined
        }
        onConfirm={handleDeleteConfirm}
        isConfirming={isDeleting}
      />
      {userId && !isDemoMode ? (
        <BillPaymentModals currency={activeCurrency} {...billPayment} />
      ) : null}
    </>
  );
}
