import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { RecurringBill } from "@/types/finance";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { useBudgetAdjustments } from "@/hooks/useBudgetAdjustments";
import { useBillPaymentDecision } from "@/hooks/useBillPaymentDecision";
import { useSupabaseFinanceData } from "@/hooks/useSupabaseFinanceData";
import { BillPaymentModals } from "@/components/BillPaymentModals";
import { AppShellHeader, appShellMaxWidthClass } from "@/components/AppShellHeader";
import { formatBillDueDateLabel } from "@/utils/recurringBills";
import { buildBillsPageModel } from "@/utils/billsPageModel";
import { getPausedGoalsAllocationCents, getGoalReallocationBoostCents } from "@/utils/paceSupport";
import { computeSafeToSpendCents } from "@/utils/safeToSpend";
import { formatMoney } from "@/utils/money";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { RecurringBillForm } from "@/components/RecurringBillForm";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickAddExpenseSheet } from "@/components/QuickAddExpenseSheet";
import { BillsSummaryCard } from "@/components/bills/BillsSummaryCard";
import { BillsFilterTabs, type BillsFilter } from "@/components/bills/BillsFilterTabs";
import { UpcomingBillRow } from "@/components/bills/UpcomingBillRow";
import { BillsCalendar } from "@/components/bills/BillsCalendar";
import { RecentlyPaidCard } from "@/components/bills/RecentlyPaidCard";
import { BillsEmptyState } from "@/components/bills/BillsEmptyState";

export default function BillsPage() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const {
    recurringBills,
    allExpenses,
    allCategories,
    budget,
    addRecurringBill,
    updateRecurringBill,
    deleteRecurringBill,
    markRecurringBillPaid,
    addExpense,
    currentMonth,
    setCurrentMonth,
    incomeCycle,
    selectedCycle,
    upcomingBills,
    upcomingUnpaidBillsCents,
    totalSpentCents,
    savingsGoalAllocationCents,
    savingsGoals,
  } = useSupabaseFinanceData();

  const userId = user?.id ?? (isDemoMode ? "demo" : "");
  const { adjustments, refresh } = useBudgetAdjustments(userId || undefined, currentMonth);

  const [activeFilter, setActiveFilter] = useState<BillsFilter>("all");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringBill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeCurrency = budget?.currency ?? "EUR";
  const today = useMemo(() => new Date(), []);

  const model = useMemo(
    () =>
      buildBillsPageModel({
        upcomingBills,
        allRecurringBills: recurringBills,
        allExpenses,
        today,
      }),
    [allExpenses, recurringBills, today, upcomingBills],
  );

  const pausedGoalsBoostCents = getPausedGoalsAllocationCents(savingsGoals, adjustments.pausedGoalIds);
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

  const filterOptions = useMemo(
    () => [
      { value: "all" as const, label: "All", count: model.upcomingBills.length },
      { value: "this-week" as const, label: "This week", count: model.thisWeekBills.length },
      { value: "recurring" as const, label: "Recurring", count: model.recurringBills.length },
      { value: "one-time" as const, label: "One-time", count: model.oneTimeBills.length },
      { value: "overdue" as const, label: "Overdue", count: model.overdueBills.length },
    ],
    [model],
  );

  const filteredBills = useMemo(() => {
    if (selectedCalendarDate) {
      return model.upcomingBills.filter(
        (bill) => bill.nextDueDate.slice(0, 10) === selectedCalendarDate,
      );
    }
    switch (activeFilter) {
      case "this-week":
        return model.thisWeekBills;
      case "recurring":
        return model.recurringBills;
      case "one-time":
        return model.oneTimeBills;
      case "overdue":
        return model.overdueBills;
      default:
        return model.upcomingBills;
    }
  }, [activeFilter, model, selectedCalendarDate]);

  const hasAnyBills = recurringBills.length > 0;

  const handleAddClick = () => {
    setEditingBill(null);
    setIsFormOpen(true);
  };

  const handleEdit = (bill: RecurringBill) => {
    setEditingBill(bill);
    setIsFormOpen(true);
  };

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

  const emptyUpcoming = (() => {
    if (!hasAnyBills) {
      return (
        <BillsEmptyState
          title="No bills yet"
          description="Add recurring and one-time bills to see what is due before your next income date."
          actionLabel="Add your first bill"
          onAction={handleAddClick}
        />
      );
    }
    if (selectedCalendarDate) {
      return (
        <BillsEmptyState
          compact
          description={`No bills scheduled for ${formatBillDueDateLabel(selectedCalendarDate, "MMMM d")}.`}
        />
      );
    }
    if (activeFilter === "overdue") {
      return <BillsEmptyState compact description="No overdue bills. Nicely done." />;
    }
    return <BillsEmptyState compact description="No unpaid bills are scheduled right now." />;
  })();

  return (
    <>
      <Helmet>
        <title>Bills</title>
      </Helmet>
      <div className="flex min-h-dvh flex-col bg-background">
        <AppShellHeader
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          incomeCycle={incomeCycle}
          selectedCycle={selectedCycle}
          currency={activeCurrency}
          contentMaxWidth={appShellMaxWidthClass}
          subtitle="BILLS & PAYMENTS"
        />

        <main
          className={`container ${appShellMaxWidthClass} flex-1 space-y-4 px-5 pb-mobile-nav pr-mobile-fab pt-4 sm:px-7 sm:pt-5 md:pb-10 md:pr-4 lg:px-9 lg:pt-6`}
        >
          <div className="bills-page-grid">
            <div className="bills-page-main">
              <BillsSummaryCard
                dueBeforeNextIncomeCents={model.dueBeforeNextIncomeCents}
                bills={model.upcomingBills}
                currency={activeCurrency}
                onAddBill={handleAddClick}
                today={today}
              />

              <section
                className="card-dashboard dashboard-card-fill w-full rounded-[1.5rem] p-5 sm:p-6 lg:rounded-[1.875rem]"
                aria-labelledby="upcoming-bills-heading"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="upcoming-bills-heading"
                    className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-[#1A1411]"
                  >
                    Upcoming
                  </h2>
                  {!selectedCalendarDate ? (
                    <BillsFilterTabs
                      active={activeFilter}
                      options={filterOptions}
                      onChange={setActiveFilter}
                      className="w-full sm:w-auto"
                    />
                  ) : null}
                </div>

                {selectedCalendarDate ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-full bg-[#EFE7F7] px-4 py-2 text-sm text-[#4A3463]">
                    <span>
                      Showing bills due on {formatBillDueDateLabel(selectedCalendarDate, "MMMM d")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarDate(null)}
                      className="touch-hit inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium hover:bg-white/60"
                      aria-label="Clear selected day filter"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      Clear
                    </button>
                  </div>
                ) : null}

                {filteredBills.length === 0 ? (
                  emptyUpcoming
                ) : (
                  <ul className="mt-4 space-y-2.5" role="list">
                    {filteredBills.map((bill) => (
                      <li key={bill.id}>
                        <UpcomingBillRow
                          bill={bill}
                          currency={activeCurrency}
                          onMarkPaid={(target) => void billPayment.requestMarkPaid(target)}
                          onEdit={handleEdit}
                          onDelete={setDeleteTarget}
                          isPaying={billPayment.payingBillId === bill.id}
                          highlighted={
                            selectedCalendarDate != null &&
                            bill.nextDueDate.slice(0, 10) === selectedCalendarDate
                          }
                          today={today}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="bills-page-sidebar">
              <BillsCalendar
                month={currentMonth}
                calendarEvents={model.calendarEvents}
                selectedDate={selectedCalendarDate}
                onSelectDate={setSelectedCalendarDate}
                today={today}
              />
              <RecentlyPaidCard items={model.recentlyPaidBills} currency={activeCurrency} />
            </div>
          </div>
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
