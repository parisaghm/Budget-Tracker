import { Link } from "react-router-dom";
import { Lightbulb, Zap } from "lucide-react";
import { AnimatedMoney } from "@/components/AnimatedMoney";
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
  onMarkPaid?: (bill: RecurringBill) => void;
  markingBillId?: string | null;
  /** Max bills shown in the preview list. */
  maxVisible?: number;
  /** Optional income date label for non-duplicative subtitle (e.g. "Jun 15"). */
  nextIncomeDateLabel?: string | null;
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
  totalDueBeforeSalaryCents: _totalDueBeforeSalaryCents,
  hasAnyRecurringBills,
  currency = "EUR",
  onMarkPaid,
  markingBillId = null,
  maxVisible = 3,
  nextIncomeDateLabel = null,
}: UpcomingBillsCardProps) {
  const preview = bills.slice(0, maxVisible);

  const subtitle = (() => {
    if (preview.length === 0) {
      return !hasAnyRecurringBills
        ? "No upcoming bills yet."
        : "No unpaid bills scheduled right now.";
    }
    if (nextIncomeDateLabel) {
      return `${preview.length} bill${preview.length === 1 ? "" : "s"} before ${nextIncomeDateLabel}`;
    }
    return `${preview.length} bill${preview.length === 1 ? "" : "s"} coming up`;
  })();

  return (
    <section
      className="card-dashboard dashboard-card-hover dashboard-card-fill w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-6"
      aria-labelledby="upcoming-bills-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="upcoming-bills-heading"
            className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-[#1A1411] sm:text-[1.125rem]"
          >
            Upcoming bills
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#746A5D]">{subtitle}</p>
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
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="money-amount-sm text-[0.9375rem]">
                      <AnimatedMoney
                        cents={bill.amountCents}
                        currency={currency}
                        variant="inline"
                        animateOnMount
                        duration={550}
                      />
                    </span>
                    {onMarkPaid ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full border-[#E8DFCC] bg-[#FFFDF8] px-2.5 text-xs text-[#2B221B] hover:bg-[#EFE7F7] hover:text-[#4A3463]"
                        disabled={markingBillId === bill.id}
                        onClick={() => onMarkPaid(bill)}
                      >
                        {markingBillId === bill.id ? "Saving…" : "Mark as paid"}
                      </Button>
                    ) : null}
                  </div>
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
