import { toast } from "sonner";
import { undoLastBudgetAction } from "@/utils/budgetDecisions";

export function showBudgetUpdatedToast(
  userId: string,
  month: string,
  description: string,
  onUndone: () => void,
): void {
  toast.success("Budget updated", {
    description,
    action: {
      label: "Undo",
      onClick: () => {
        if (undoLastBudgetAction(userId, month)) {
          onUndone();
          toast.message("Undone", { description: "Restored your previous plan for this month." });
        } else {
          toast.error("Nothing to undo");
        }
      },
    },
  });
}
