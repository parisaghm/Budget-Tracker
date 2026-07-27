import { useEffect, useMemo, useState } from "react";
import type { SavingsGoal } from "@/types/finance";
import { formatMoney, getCurrencySymbol } from "@/utils/money";
import {
  allocationGoals,
  buildCompleteAllocationPayload,
  parseAmountInputToCents,
  validateCycleAllocation,
} from "@/utils/savingsAllocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface AllocateCycleSavingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: SavingsGoal[];
  currency?: string;
  plannedSavingsCents: number;
  allocatedThisCycleCents: number;
  contributionsByGoal: Record<string, number>;
  focusGoalId?: string | null;
  isSaving?: boolean;
  onSave: (payload: Array<{ goal_id: string; amount_cents: number }>) => Promise<void>;
}

export function AllocateCycleSavingsDialog({
  open,
  onOpenChange,
  goals,
  currency = "EUR",
  plannedSavingsCents,
  allocatedThisCycleCents,
  contributionsByGoal,
  focusGoalId = null,
  isSaving = false,
  onSave,
}: AllocateCycleSavingsDialogProps) {
  const eligible = useMemo(() => allocationGoals(goals), [goals]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const goal of eligible) {
      const cents = contributionsByGoal[goal.id] ?? 0;
      next[goal.id] = cents > 0 ? (cents / 100).toFixed(2) : "";
    }
    setAmounts(next);
    setSubmitError(null);
  }, [open, eligible, contributionsByGoal]);

  const amountsByGoalCents = useMemo(() => {
    const result: Record<string, number> = {};
    for (const goal of eligible) {
      const parsed = parseAmountInputToCents(amounts[goal.id] ?? "");
      result[goal.id] = Number.isNaN(parsed) ? -1 : parsed;
    }
    return result;
  }, [amounts, eligible]);

  const hasInvalidInput = Object.values(amountsByGoalCents).some((v) => v < 0);

  const validation = useMemo(() => {
    if (hasInvalidInput) {
      return {
        valid: false,
        totalCents: 0,
        remainingCents: Math.max(0, plannedSavingsCents),
        error: "Enter a valid non-negative amount.",
      };
    }
    return validateCycleAllocation(amountsByGoalCents, plannedSavingsCents);
  }, [amountsByGoalCents, hasInvalidInput, plannedSavingsCents]);

  const availableToAllocate = Math.max(0, plannedSavingsCents - allocatedThisCycleCents);
  const canSave = validation.valid && !isSaving && eligible.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitError(null);
    const payload = buildCompleteAllocationPayload(eligible, amountsByGoalCents);
    try {
      await onSave(payload);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save allocation";
      setSubmitError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allocate this cycle&apos;s savings</DialogTitle>
          <DialogDescription>
            Split reserved savings across your goals. Total cannot exceed this cycle&apos;s savings plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Savings planned</span>
            <span className="font-medium money-display">
              {formatMoney(plannedSavingsCents, currency)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Allocated to goals</span>
            <span className="font-medium money-display">
              {formatMoney(allocatedThisCycleCents, currency)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Available to allocate</span>
            <span className="font-medium money-display">
              {formatMoney(availableToAllocate, currency)}
            </span>
          </div>
        </div>

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a savings goal first to allocate this cycle&apos;s savings.
          </p>
        ) : (
          <div className="grid max-h-[40vh] gap-4 overflow-y-auto py-2">
            {eligible.map((goal) => (
              <div key={goal.id} className="grid gap-2">
                <Label htmlFor={`alloc-${goal.id}`}>{goal.name}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {getCurrencySymbol(currency)}
                  </span>
                  <Input
                    id={`alloc-${goal.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7"
                    autoFocus={focusGoalId === goal.id}
                    value={amounts[goal.id] ?? ""}
                    onChange={(e) =>
                      setAmounts((prev) => ({ ...prev, [goal.id]: e.target.value }))
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1 text-sm">
          <p className="flex justify-between gap-2">
            <span className="text-muted-foreground">Allocated</span>
            <span className="money-display">
              {formatMoney(validation.totalCents, currency)} / {formatMoney(plannedSavingsCents, currency)}
            </span>
          </p>
          <p className="flex justify-between gap-2">
            <span className="text-muted-foreground">Remaining</span>
            <span className="money-display">
              {formatMoney(Math.max(0, validation.remainingCents), currency)}
            </span>
          </p>
          {(validation.error || submitError) && (
            <p className="text-sm text-destructive" role="alert">
              {submitError ?? validation.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {isSaving ? "Saving…" : "Save allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
