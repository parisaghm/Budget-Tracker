import { Plus } from "lucide-react";
import type { RecurringBill } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { formatBillRelativeTiming } from "@/utils/billsPageModel";
import { Button } from "@/components/ui/button";

interface BillsSummaryCardProps {
  dueBeforeNextIncomeCents: number;
  bills: RecurringBill[];
  currency: string;
  onAddBill: () => void;
  today?: Date;
}

export function BillsSummaryCard({
  dueBeforeNextIncomeCents,
  bills,
  currency,
  onAddBill,
  today = new Date(),
}: BillsSummaryCardProps) {
  const count = bills.length;
  const nextBill = bills[0] ?? null;
  const hasBills = count > 0;

  const secondaryLine = hasBills && nextBill
    ? `${count} bill${count === 1 ? "" : "s"} · next is ${nextBill.name} ${formatBillRelativeTiming(nextBill.nextDueDate, today)}`
    : "No unpaid bills before your next income date.";

  const helperText = hasBills
    ? "Total unpaid bills due before your next income date."
    : "You're all caught up for this cycle.";

  return (
    <section
      className="card-dashboard dashboard-card-fill w-full rounded-[1.5rem] p-5 sm:p-6 lg:rounded-[1.875rem] lg:p-7"
      aria-labelledby="bills-summary-heading"
    >
      <div className="flex items-start justify-between gap-4">
        <p
          id="bills-summary-heading"
          className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#8A7F6E]"
        >
          Due before next income
        </p>
        <Button
          type="button"
          onClick={onAddBill}
          className="touch-hit h-9 shrink-0 gap-1.5 rounded-full px-4 text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add bill
        </Button>
      </div>

      <p className="mt-3 font-display text-[2.5rem] font-medium leading-none tracking-[-0.02em] text-[#1A1411] sm:text-[3rem]">
        {formatMoney(dueBeforeNextIncomeCents, currency)}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-[#746A5D]">{helperText}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#2B221B]">
        {hasBills && nextBill ? (
          <>
            {count} bill{count === 1 ? "" : "s"} · next is{" "}
            <span className="font-medium">{nextBill.name}</span>{" "}
            {formatBillRelativeTiming(nextBill.nextDueDate, today)}
          </>
        ) : (
          secondaryLine
        )}
      </p>
    </section>
  );
}
