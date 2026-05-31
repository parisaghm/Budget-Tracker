import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { resetMonthBudgetPlan } from "@/utils/budgetDecisions";
import { formatMonthNameOnly } from "@/utils/money";
import { BudgetActionConfirmDialog } from "@/components/budget/BudgetActionConfirmDialog";
import { Button } from "@/components/ui/button";

interface ResetMonthPlanButtonProps {
  userId: string;
  month: string;
  onReset: () => void;
  variant?: "default" | "outline";
  className?: string;
}

export function ResetMonthPlanButton({
  userId,
  month,
  onReset,
  variant = "outline",
  className,
}: ResetMonthPlanButtonProps) {
  const [open, setOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const monthName = formatMonthNameOnly(month);

  const handleReset = () => {
    setIsResetting(true);
    try {
      resetMonthBudgetPlan(userId, month);
      onReset();
      toast.success("Month plan reset", {
        description: `${monthName}'s plan was recalculated from your income, bills, goals, and spending. Expenses and bills were not deleted.`,
      });
      setOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
        Reset this month&apos;s plan
      </Button>
      <BudgetActionConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Reset ${monthName}'s plan?`}
        description={`This clears carry-over choices, overspend adjustments, and weekly reductions for ${monthName}. Your monthly income, expenses, bills, and savings goals stay as they are — only the calculated plan is rebuilt.`}
        confirmLabel="Reset plan"
        isConfirming={isResetting}
        onConfirm={handleReset}
      />
    </>
  );
}
