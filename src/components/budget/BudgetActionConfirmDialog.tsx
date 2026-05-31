import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface BudgetActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
}

export function BudgetActionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Apply",
  isConfirming = false,
  onConfirm,
}: BudgetActionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(open) => !isConfirming && onOpenChange(open)}>
      <AlertDialogContent className="sm:rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
          <Button disabled={isConfirming} onClick={() => void onConfirm()}>
            {isConfirming ? "Applying…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
