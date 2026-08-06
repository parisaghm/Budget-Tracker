import { Link } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import type { RecurringBill } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { formatBillDueDateLabel, getDaysUntil } from "@/utils/recurringBills";
import { CategoryIconAvatar } from "@/components/CategoryIconAvatar";
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
            className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-foreground sm:text-[1.125rem]"
          >
            Upcoming bills
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          to="/bills"
          className="touch-hit shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary"
        >
          All bills →
        </Link>
      </div>

      {preview.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          {!hasAnyRecurringBills
            ? "No upcoming bills yet."
            : "No unpaid bills scheduled right now."}
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5" role="list">
          {preview.map((bill) => {
            const days = getDaysUntil(bill.nextDueDate);
            return (
              <li key={bill.id}>
                <div className="bill-row-lifted">
                  <CategoryIconAvatar
                    categoryValue={bill.category}
                    label={bill.name}
                    size="sm"
                    className="bg-accent"
                    iconClassName="text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{bill.name}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
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
                        className="h-7 rounded-full border-border bg-popover px-2.5 text-xs text-foreground hover:bg-accent hover:text-primary"
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
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-medium">Tip:</span> Pay early and keep your future self relaxed.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="shrink-0 rounded-full border-border bg-popover text-foreground hover:bg-accent hover:text-primary"
          >
            <Link to="/bills">See all bills</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
