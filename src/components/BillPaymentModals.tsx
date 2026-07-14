import { Flag, PiggyBank } from "lucide-react";
import { useBillPaymentDecision } from "@/hooks/useBillPaymentDecision";
import { formatMoney } from "@/utils/money";
import { calculateGoalPlan } from "@/utils/goalPlan";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BillPaymentModalsProps = ReturnType<typeof useBillPaymentDecision> & {
  currency: string;
};

export function BillPaymentModals({
  currency,
  isSaving,
  pending,
  setPending,
  savingsAmount,
  setSavingsAmount,
  savingsAmountError,
  canConfirmMoveSavings,
  selectedGoalId,
  setSelectedGoalId,
  selectedSavingsGoalId,
  setSelectedSavingsGoalId,
  movableGoals,
  pausableGoals,
  selectedMovableGoal,
  maxMoveCents,
  fundingShortfallCents,
  currencySymbol,
  openMoveSavings,
  openPauseGoal,
  applyMoveSavings,
  applyPauseGoal,
}: BillPaymentModalsProps) {
  const fundingBill = pending?.bill;

  return (
    <>
      <Dialog
        open={pending?.kind === "funding"}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
      >
        <DialogContent className="sm:max-w-md sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>You don&apos;t have enough safe-to-spend for this bill.</DialogTitle>
            <DialogDescription>
              {fundingBill
                ? `${fundingBill.name} is ${formatMoney(fundingBill.amountCents, currency)}. Free up room in this cycle, then mark it paid.`
                : "Free up room in this cycle, then try again."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 py-3 text-left"
              disabled={isSaving || movableGoals.length === 0}
              onClick={() =>
                fundingBill &&
                openMoveSavings(fundingBill, pending?.wasBillReserved ?? false)
              }
            >
              <PiggyBank className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                <span className="block font-medium">Move money from savings</span>
                <span className="block text-xs text-muted-foreground">
                  {movableGoals.length === 0
                    ? "No savings allocation left this cycle"
                    : fundingShortfallCents > 0
                      ? `Need at least ${formatMoney(fundingShortfallCents, currency)}`
                      : "Reduce this cycle's goals allocation"}
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 py-3 text-left"
              disabled={isSaving || pausableGoals.length === 0}
              onClick={() =>
                fundingBill && openPauseGoal(fundingBill, pending?.wasBillReserved ?? false)
              }
            >
              <Flag className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                <span className="block font-medium">Pause a goal temporarily</span>
                <span className="block text-xs text-muted-foreground">
                  {pausableGoals.length === 0
                    ? "No active goals with a monthly amount"
                    : "Return this month's goal amount to spending room"}
                </span>
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={isSaving}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pending?.kind === "move_savings"}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
      >
        <DialogContent className="sm:max-w-md sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Move money from savings</DialogTitle>
            <DialogDescription>
              Reduce this cycle&apos;s savings/goals allocation and add it back to safe-to-spend.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {movableGoals.length > 1 ? (
              <div className="grid gap-2">
                <Label>Savings / goal to reduce</Label>
                <Select
                  value={selectedSavingsGoalId}
                  onValueChange={(id) => {
                    setSelectedSavingsGoalId(id);
                    setSavingsAmount("");
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl border-border/60 bg-popover/80">
                    <SelectValue placeholder="Choose a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {movableGoals.map(({ goal, availableCents }) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.name} ({formatMoney(availableCents, currency)} available)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : selectedMovableGoal ? (
              <p className="text-sm text-muted-foreground">
                From &quot;{selectedMovableGoal.goal.name}&quot; —{" "}
                {formatMoney(selectedMovableGoal.availableCents, currency)} available this cycle
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="bill-savings-amount">Amount ({currencySymbol})</Label>
              <Input
                id="bill-savings-amount"
                type="number"
                min="0"
                step="0.01"
                max={maxMoveCents > 0 ? maxMoveCents / 100 : undefined}
                value={savingsAmount}
                onChange={(e) => setSavingsAmount(e.target.value)}
                autoFocus
              />
              {fundingShortfallCents > 0 ? (
                <p className="text-xs text-muted-foreground">
                  At least {formatMoney(fundingShortfallCents, currency)} needed for this bill
                </p>
              ) : null}
              {maxMoveCents > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Up to {formatMoney(maxMoveCents, currency)} available
                </p>
              ) : null}
              {savingsAmountError ? (
                <p className="text-xs text-destructive">{savingsAmountError}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              disabled={isSaving || !canConfirmMoveSavings}
              onClick={() => void applyMoveSavings()}
            >
              {isSaving ? "Applying…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pending?.kind === "pause_goal"}
        onOpenChange={(open) => !open && !isSaving && setPending(null)}
      >
        <DialogContent className="sm:max-w-md sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Pause a goal temporarily</DialogTitle>
            <DialogDescription>
              This month&apos;s planned amount returns to your spending room. The goal stays on your
              list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {pausableGoals.length > 1 ? (
              <div className="grid gap-2">
                <Label>Goal to pause</Label>
                <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                  <SelectTrigger className="h-10 rounded-xl border-border/60 bg-popover/80">
                    <SelectValue placeholder="Choose a goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {pausableGoals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : pausableGoals[0] ? (
              <p className="text-sm text-muted-foreground">
                Pause &quot;{pausableGoals[0].name}&quot; (
                {formatMoney(
                  calculateGoalPlan(pausableGoals[0]).monthlyRequiredSavingCents,
                  currency,
                )}{" "}
                this month)?
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              disabled={isSaving || !selectedGoalId}
              onClick={() => void applyPauseGoal()}
            >
              {isSaving ? "Applying…" : "Pause for this month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
