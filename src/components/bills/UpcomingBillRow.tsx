import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { RecurringBill } from "@/types/finance";
import { formatMoney } from "@/utils/money";
import { formatBillDueDateLabel } from "@/utils/recurringBills";
import {
  formatBillRelativeTiming,
  getBillRecurrenceLabel,
  getBillTiming,
} from "@/utils/billsPageModel";
import { CategoryIconAvatar } from "@/components/CategoryIconAvatar";
import { BillStatusBadge, type BillStatusVariant } from "@/components/bills/BillStatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UpcomingBillRowProps {
  bill: RecurringBill;
  currency: string;
  onMarkPaid: (bill: RecurringBill) => void;
  onEdit: (bill: RecurringBill) => void;
  onDelete: (bill: RecurringBill) => void;
  isPaying: boolean;
  highlighted?: boolean;
  today?: Date;
}

function statusVariant(bill: RecurringBill, today: Date): BillStatusVariant {
  const timing = getBillTiming(bill.nextDueDate, today);
  if (timing === "overdue") return "overdue";
  if (timing === "today") return "today";
  if (bill.paymentCount === 1) return "one-time";
  return "upcoming";
}

export function UpcomingBillRow({
  bill,
  currency,
  onMarkPaid,
  onEdit,
  onDelete,
  isPaying,
  highlighted = false,
  today = new Date(),
}: UpcomingBillRowProps) {
  const variant = statusVariant(bill, today);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-3.5 transition-colors sm:flex-row sm:items-center sm:gap-4",
        highlighted && "border-primary/50 ring-1 ring-primary/30",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CategoryIconAvatar
          categoryValue={bill.category}
          label={bill.name}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{bill.name}</p>
            <BillStatusBadge variant={variant} />
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {formatBillDueDateLabel(bill.nextDueDate)} · {getBillRecurrenceLabel(bill)} ·{" "}
            {formatBillRelativeTiming(bill.nextDueDate, today)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="money-amount-sm text-[0.9375rem] font-semibold text-foreground">
          {formatMoney(bill.amountCents, currency)}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-border bg-popover px-3 text-xs text-foreground hover:bg-accent hover:text-primary"
            disabled={isPaying}
            onClick={() => onMarkPaid(bill)}
            aria-label={`Mark ${bill.name} as paid`}
          >
            {isPaying ? "Saving…" : "Mark paid"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="touch-hit flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`More actions for ${bill.name}`}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => onEdit(bill)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete(bill)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
