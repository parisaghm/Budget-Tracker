import { Link } from "react-router-dom";
import { Lightbulb, Zap } from "lucide-react";
import type { RecurringBill } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { formatBillDueDateLabel, getDaysUntil } from "@/utils/recurringBills";
import { getCategoryIcon } from "@/utils/categoryIcons";
import { Button } from "@/components/ui/button";

interface UpcomingBillsCardProps {
  /** Unpaid upcoming bills sorted by `nextDueDate` (caller passes `getUpcomingBills` result). */
  bills: RecurringBill[];
  totalDueBeforeSalaryCents: number;
  hasAnyRecurringBills: boolean;
  currency?: string;
}

function timingLabel(daysUntil: number | null): string {
  if (daysUntil == null) return "";
  if (daysUntil < 0) {
    const n = Math.abs(daysUntil);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (daysUntil === 0) return "due today";
  return `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
}

export function UpcomingBillsCard({
  bills,
  totalDueBeforeSalaryCents,
  hasAnyRecurringBills,
  currency = "EUR",
}: UpcomingBillsCardProps) {
  const preview = bills.slice(0, 3);

  return (
    <section className="card-dashboard p-6 sm:p-8" aria-labelledby="upcoming-bills-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="upcoming-bills-heading"
            className="text-lg font-semibold tracking-[-0.015em] text-[#1A1411] sm:text-[1.125rem]"
          >
            Upcoming bills
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#746A5D]">
            {totalDueBeforeSalaryCents > 0
              ? `${formatMoney(totalDueBeforeSalaryCents, currency)} before your income date`
              : "Nothing due before your next income date."}
          </p>
        </div>
        <Link
          to="/bills"
          className="touch-hit shrink-0 text-sm font-medium text-[#6E4E91] transition-colors hover:text-[#4A3463]"
        >
          All bills →
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="mt-5 text-sm text-[#746A5D]">
          {!hasAnyRecurringBills
            ? "No upcoming bills yet."
            : "No unpaid bills scheduled right now."}
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5" role="list">
          {preview.map((bill) => {
            const days = getDaysUntil(bill.nextDueDate);
            const Icon = bill.category ? getCategoryIcon(bill.category as never) : Zap;
            return (
              <li key={bill.id}>
                <div className="bill-row-lifted">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFE7F7]">
                    <Icon className="h-4 w-4 text-[#6E4E91]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1A1411]">{bill.name}</p>
                    <p className="text-xs leading-relaxed text-[#746A5D]">
                      {timingLabel(days)} · {formatBillDueDateLabel(bill.nextDueDate)}
                    </p>
                  </div>
                  <span className="money-amount-sm shrink-0 text-[0.9375rem]">
                    {formatMoney(bill.amountCents, currency)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasAnyRecurringBills ? (
        <div className="bills-tip-box">
          <div className="flex min-w-0 items-start gap-2.5">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#B07A3B]" aria-hidden />
            <p className="text-sm leading-relaxed text-[#2B221B]">
              <span className="font-medium">Tip:</span> Pay early and keep your future self relaxed.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="shrink-0 rounded-full border-[#E8DFCC] bg-[#FFFDF8] text-[#2B221B] hover:bg-[#EFE7F7] hover:text-[#4A3463]"
          >
            <Link to="/bills">See all bills</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
