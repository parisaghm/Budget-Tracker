import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Target, Plus, Trash2, Pencil, Calendar, Clock, Wallet } from "lucide-react";
import { SavingsGoal as SavingsGoalType } from "@/types/finance";
import { formatMoney, eurosToCents, centsToEuros, getCurrencySymbol } from "@/utils/money";
import { calculateGoalPlan } from "@/utils/goalPlan";
import {
  allocationGoals,
  buildSavingsPlanGoalInput,
  findMonthlySavingsPlanGoal,
  monthlyPlanCentsFromMetaGoal,
} from "@/utils/savingsAllocation";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { AllocateCycleSavingsDialog } from "@/components/savings/AllocateCycleSavingsDialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SavingsGoalsProps {
  goals: SavingsGoalType[];
  currency?: string;
  hasSavingsPlan: boolean;
  plannedSavingsCents: number;
  allocatedThisCycleCents: number;
  availableToAllocateCents: number;
  contributionsByGoal: Record<string, number>;
  canAllocate: boolean;
  isSavingAllocation?: boolean;
  /** Prefill for set-plan dialog (e.g. onboarding localStorage monthly cents). */
  suggestedPlanMonthlyCents?: number;
  onSaveAllocation: (
    payload: Array<{ goal_id: string; amount_cents: number }>,
  ) => Promise<void>;
  onAddGoal: (goal: {
    name: string;
    targetCents: number;
    savedCents: number;
    startDate: string;
    targetDate: string;
  }) => void | Promise<unknown>;
  onUpdateGoal: (
    goalId: string,
    updates: { name?: string; targetCents?: number; targetDate?: string; startDate?: string },
  ) => void | Promise<unknown>;
  onDeleteGoal: (goalId: string) => void;
}

export function SavingsGoals({
  goals,
  currency = "EUR",
  hasSavingsPlan,
  plannedSavingsCents,
  allocatedThisCycleCents,
  availableToAllocateCents,
  contributionsByGoal,
  canAllocate,
  isSavingAllocation = false,
  suggestedPlanMonthlyCents = 0,
  onSaveAllocation,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}: SavingsGoalsProps) {
  const displayGoals = useMemo(() => allocationGoals(goals), [goals]);
  const planGoal = useMemo(() => findMonthlySavingsPlanGoal(goals), [goals]);

  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [setPlanOpen, setSetPlanOpen] = useState(false);
  const [planMonthly, setPlanMonthly] = useState("");
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [focusGoalId, setFocusGoalId] = useState<string | null>(null);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalTargetDate, setNewGoalTargetDate] = useState("");
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoalType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openSetPlan = () => {
    const existingMonthly = planGoal ? monthlyPlanCentsFromMetaGoal(planGoal) : 0;
    const prefill =
      existingMonthly > 0
        ? existingMonthly
        : suggestedPlanMonthlyCents > 0
          ? suggestedPlanMonthlyCents
          : 50000;
    setPlanMonthly((prefill / 100).toFixed(2));
    setSetPlanOpen(true);
  };

  const handleSavePlan = async () => {
    const monthly = eurosToCents(parseFloat(planMonthly));
    if (!Number.isFinite(monthly) || monthly <= 0) {
      toast.error("Enter a valid monthly savings amount");
      return;
    }
    setIsSavingPlan(true);
    try {
      const input = buildSavingsPlanGoalInput(monthly);
      if (planGoal) {
        await Promise.resolve(
          onUpdateGoal(planGoal.id, {
            targetCents: input.targetCents,
            startDate: input.startDate,
            targetDate: input.targetDate,
          }),
        );
      } else {
        await Promise.resolve(onAddGoal(input));
      }
      toast.success("Savings plan saved");
      setSetPlanOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save savings plan";
      toast.error("Save failed", { description: message });
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await Promise.resolve(onDeleteGoal(deleteTarget.id));
      toast.success("Goal deleted");
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete goal";
      toast.error("Delete failed", { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddGoal = () => {
    const name = newGoalName.trim();
    const value = parseFloat(newGoalTarget);
    if (!name || isNaN(value) || value <= 0 || !newGoalTargetDate) return;
    const targetDate = `${newGoalTargetDate}-01`;
    const startDate = new Date().toISOString().slice(0, 10);
    void onAddGoal({
      name,
      targetCents: eurosToCents(value),
      savedCents: 0,
      startDate,
      targetDate,
    });
    setNewGoalName("");
    setNewGoalTarget("");
    setNewGoalTargetDate("");
    setAddGoalOpen(false);
  };

  const openAllocate = (goalId?: string) => {
    setFocusGoalId(goalId ?? null);
    setAllocateOpen(true);
  };

  const openEdit = (goal: SavingsGoalType) => {
    setEditGoalId(goal.id);
    setEditName(goal.name);
    setEditTarget(centsToEuros(goal.targetCents).toFixed(2));
    setEditTargetDate(goal.targetDate.slice(0, 7));
  };

  const handleSaveEdit = () => {
    if (!editGoalId) return;
    const name = editName.trim();
    const value = parseFloat(editTarget);
    if (!name || isNaN(value) || value <= 0 || !editTargetDate) return;
    void onUpdateGoal(editGoalId, {
      name,
      targetCents: eurosToCents(value),
      targetDate: `${editTargetDate}-01`,
    });
    setEditGoalId(null);
    setEditName("");
    setEditTarget("");
    setEditTargetDate("");
  };

  const allocationEnabled = canAllocate && hasSavingsPlan && displayGoals.length > 0;

  return (
    <div className="card-elevated space-y-6 p-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Savings Goals</h2>
            <p className="text-xs text-muted-foreground">Track progress toward your targets</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => openAllocate()}
            disabled={!allocationEnabled}
          >
            <Wallet className="h-4 w-4" />
            Allocate this cycle&apos;s savings
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddGoalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add goal
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Savings planned</p>
          {hasSavingsPlan ? (
            <p className="font-semibold money-display">{formatMoney(plannedSavingsCents, currency)}</p>
          ) : (
            <div className="mt-1 space-y-2">
              <p className="font-semibold text-foreground">Savings plan not set</p>
              <Button size="sm" variant="secondary" onClick={openSetPlan}>
                Set savings plan
              </Button>
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Allocated to goals</p>
          <p className="font-semibold money-display">
            {formatMoney(allocatedThisCycleCents, currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Available to allocate</p>
          <p className="font-semibold money-display">
            {hasSavingsPlan ? formatMoney(availableToAllocateCents, currency) : formatMoney(0, currency)}
          </p>
        </div>
      </div>

      {hasSavingsPlan ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={openSetPlan}>
            Edit savings plan
          </Button>
        </div>
      ) : null}

      {displayGoals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
          <p className="mb-3 text-sm text-muted-foreground">No savings goals yet</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Create a goal, then allocate this cycle&apos;s reserved savings across your goals.
          </p>
          <Button onClick={() => setAddGoalOpen(true)} variant="secondary" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add your first goal
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {displayGoals.map((goal) => {
            const remaining = Math.max(0, goal.targetCents - goal.savedCents);
            const progressPercent =
              goal.targetCents > 0
                ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100))
                : 0;
            const plan = calculateGoalPlan(goal);
            const targetDateFormatted = format(parseISO(goal.targetDate), "MMM yyyy");

            return (
              <div key={goal.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{goal.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Target: {formatMoney(goal.targetCents, currency)} · Saved:{" "}
                      {formatMoney(goal.savedCents, currency)} · Remaining:{" "}
                      {formatMoney(remaining, currency)}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        Target date: {targetDateFormatted}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        Time left: {plan.monthsRemaining}{" "}
                        {plan.monthsRemaining === 1 ? "month" : "months"}
                      </p>
                      {plan.monthsRemaining > 0 && (
                        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Wallet className="h-3.5 w-3.5 shrink-0" />
                          Recommended saving:{" "}
                          {formatMoney(plan.monthlyRequiredSavingCents, currency)} / month
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(goal)}
                      title="Edit goal"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(goal)}
                      title="Delete goal"
                      aria-label={`Delete goal ${goal.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress value={progressPercent} className="h-2.5" />
                  <p className="text-xs font-medium text-muted-foreground">{progressPercent}%</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => openAllocate(goal.id)}
                  disabled={!allocationEnabled || remaining <= 0}
                >
                  <Plus className="h-4 w-4" />
                  Allocate savings
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <AllocateCycleSavingsDialog
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        goals={displayGoals}
        currency={currency}
        plannedSavingsCents={plannedSavingsCents}
        allocatedThisCycleCents={allocatedThisCycleCents}
        contributionsByGoal={contributionsByGoal}
        focusGoalId={focusGoalId}
        isSaving={isSavingAllocation}
        onSave={async (payload) => {
          await onSaveAllocation(payload);
          toast.success("Allocation saved");
        }}
      />

      <Dialog open={setPlanOpen} onOpenChange={(open) => !isSavingPlan && setSetPlanOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set savings plan</DialogTitle>
            <DialogDescription>
              How much do you want to reserve from Safe to Spend each cycle? This is the amount you
              can allocate across goals — not the sum of each goal&apos;s recommended saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="plan-monthly">Monthly / cycle savings ({getCurrencySymbol(currency)})</Label>
            <Input
              id="plan-monthly"
              type="number"
              min="0"
              step="0.01"
              value={planMonthly}
              onChange={(e) => setPlanMonthly(e.target.value)}
              disabled={isSavingPlan}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetPlanOpen(false)} disabled={isSavingPlan}>
              Cancel
            </Button>
            <Button onClick={() => void handleSavePlan()} disabled={isSavingPlan}>
              {isSavingPlan ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addGoalOpen} onOpenChange={setAddGoalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New savings goal</DialogTitle>
            <DialogDescription>Set a target and start saving toward it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="goal-name">Goal name</Label>
              <Input
                id="goal-name"
                placeholder="e.g. Buy a Car"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-target">Target amount (€)</Label>
              <Input
                id="goal-target"
                type="number"
                min="0"
                step="0.01"
                placeholder="25000"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal-target-date">Target date</Label>
              <Input
                id="goal-target-date"
                type="month"
                value={newGoalTargetDate}
                onChange={(e) => setNewGoalTargetDate(e.target.value)}
                min={new Date().toISOString().slice(0, 7)}
              />
              <p className="text-xs text-muted-foreground">e.g. Dec 2026</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGoalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddGoal}
              disabled={
                !newGoalName.trim() ||
                !newGoalTarget ||
                parseFloat(newGoalTarget) <= 0 ||
                !newGoalTargetDate
              }
            >
              Add goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editGoalId} onOpenChange={(open) => !open && setEditGoalId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit goal</DialogTitle>
            <DialogDescription>Update the goal name, target amount, or target date.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-goal-name">Goal name</Label>
              <Input
                id="edit-goal-name"
                placeholder="e.g. Buy a Car"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-goal-target">
                Target amount ({getCurrencySymbol(currency)})
              </Label>
              <Input
                id="edit-goal-target"
                type="number"
                min="0"
                step="0.01"
                placeholder="25000"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-goal-target-date">Target date</Label>
              <Input
                id="edit-goal-target-date"
                type="month"
                value={editTargetDate}
                onChange={(e) => setEditTargetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGoalId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={
                !editName.trim() || !editTarget || parseFloat(editTarget) <= 0 || !editTargetDate
              }
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
        title="Delete goal?"
        description="This removes the savings goal permanently. This action cannot be undone."
        detail={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
        isConfirming={isDeleting}
      />
    </div>
  );
}
