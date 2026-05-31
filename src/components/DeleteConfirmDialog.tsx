import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  detail?: ReactNode;
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
  confirmLabel?: string;
  confirmingLabel?: string;
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  detail,
  onConfirm,
  isConfirming = false,
  confirmLabel = 'Delete',
  confirmingLabel = 'Deleting…',
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isConfirming) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-left text-sm text-muted-foreground">
              <p>{description}</p>
              {detail ? <div className="font-medium text-foreground">{detail}</div> : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={isConfirming} onClick={() => void onConfirm()}>
            {isConfirming ? confirmingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
