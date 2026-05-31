import { useState } from "react";
import { toast } from "sonner";
import { clearRolloverBoostCents } from "@/utils/budgetDecisions";
import { formatMoney } from "@/utils/money";
import { BudgetActionConfirmDialog } from "@/components/budget/BudgetActionConfirmDialog";
import { Button } from "@/components/ui/button";

interface RemoveCarriedOverButtonProps {
  userId: string;
  month: string;
  amountCents: number;
  currency: string;
  onRemoved: () => void;
  variant?: "debug" | "settings";
}

export function RemoveCarriedOverButton({
  userId,
  month,
  amountCents,
  currency,
  onRemoved,
  variant = "settings",
}: RemoveCarriedOverButtonProps) {
  const [open, setOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = () => {
    setIsRemoving(true);
    try {
      clearRolloverBoostCents(userId, month);
      onRemoved();
      toast.success("Carried-over amount removed", {
        description: `${formatMoney(amountCents, currency)} is no longer added to this cycle.`,
      });
      setOpen(false);
    } finally {
      setIsRemoving(false);
    }
  };

  if (amountCents <= 0) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant === "debug" ? "outline" : "secondary"}
        size="sm"
        className={
          variant === "debug"
            ? "mt-2 h-8 border-amber-500/40 text-[10px] font-normal"
            : "w-full"
        }
        onClick={() => setOpen(true)}
      >
        Remove carried-over amount ({formatMoney(amountCents, currency)})
      </Button>
      <BudgetActionConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove carried-over amount?"
        description={`Remove ${formatMoney(amountCents, currency)} from this cycle's available budget. Your income, expenses, bills, and goals stay the same — only this local adjustment is cleared.`}
        confirmLabel="Remove amount"
        isConfirming={isRemoving}
        onConfirm={handleRemove}
      />
    </>
  );
}
