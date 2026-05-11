import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import type { RecurringBill } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { getDaysUntil } from "@/utils/recurringBills";

interface UpcomingBillsCardProps {
  /** Unpaid upcoming bills sorted by `nextDueDate` (caller passes `getUpcomingBills` result). */
  bills: RecurringBill[];
  totalDueBeforeSalaryCents: number;
  hasAnyRecurringBills: boolean;
  currency?: string;
}

export function UpcomingBillsCard({
  bills,
  totalDueBeforeSalaryCents,
  hasAnyRecurringBills,
  currency = "EUR",
}: UpcomingBillsCardProps) {
  const preview = bills.slice(0, 3);
  const nextBill = preview[0];
  const daysUntilNextBill = nextBill ? getDaysUntil(nextBill.nextDueDate) : null;
  const nextBillTimingLabel =
    daysUntilNextBill === null
      ? null
      : daysUntilNextBill < 0
        ? `${Math.abs(daysUntilNextBill)} day${Math.abs(daysUntilNextBill) === 1 ? "" : "s"} overdue`
        : daysUntilNextBill === 0
          ? "due today"
          : `in ${daysUntilNextBill} day${daysUntilNextBill === 1 ? "" : "s"}`;

  return (
    <div className="card-elevated animate-fade-in space-y-3 p-4 sm:space-y-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 sm:h-10 sm:w-10">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold sm:text-lg">Upcoming bills</h2>
            <p className="text-xs text-muted-foreground">Next payments at a glance</p>
          </div>
        </div>
        <Link
          to="/bills"
          className="touch-hit shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:text-primary/80 sm:text-xs"
        >
          All bills
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {!hasAnyRecurringBills
            ? "No upcoming bills yet."
            : "No unpaid bills scheduled right now."}
        </p>
      ) : (
        <>
          {totalDueBeforeSalaryCents > 0 ? (
            <p className="text-sm text-foreground font-medium">
              {formatMoney(totalDueBeforeSalaryCents, currency)} due before next salary
            </p>
          ) : (
            <p className="text-sm text-foreground font-medium">
              Your next bills are coming after your next salary.
            </p>
          )}
          {nextBill && nextBillTimingLabel ? (
            <p className="text-xs text-muted-foreground">
              Next: {nextBill.name} · {nextBillTimingLabel}
            </p>
          ) : null}
          <div className="space-y-2">
            {preview.map((bill) => (
              <div
                key={bill.id}
                className="flex min-h-[3rem] items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">{bill.name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(bill.nextDueDate), "MMM d")}</p>
                </div>
                <span className="font-semibold money-display">{formatMoney(bill.amountCents, currency)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
