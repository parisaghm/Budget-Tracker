import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import type { Expense } from "@/types/finance";
import { formatMoney } from "@/utils/money";

interface ExpenseDeleteDialogProps {
  expense: Expense | null;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
}

export function ExpenseDeleteDialog({
  expense,
  currency,
  open,
  onOpenChange,
  onConfirm,
  isConfirming = false,
}: ExpenseDeleteDialogProps) {
  const amountLabel = expense ? formatMoney(expense.amountCents, currency) : "";

  return (
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete expense?"
      description={
        expense
          ? `This will remove ${amountLabel} from this cycle and recalculate your spending totals.`
          : "This will remove the expense and recalculate your spending totals."
      }
      detail={
        expense ? (
          <>
            {expense.note?.trim() || "Untitled expense"}
            {" · "}
            {amountLabel}
          </>
        ) : undefined
      }
      onConfirm={onConfirm}
      isConfirming={isConfirming}
      confirmLabel="Delete expense"
      confirmingLabel="Deleting…"
    />
  );
}
