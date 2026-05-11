import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Target, Plus, Trash2, Pencil, Calendar, Clock, Wallet } from 'lucide-react';
import { SavingsGoal as SavingsGoalType } from '@/types/finance';
import { formatMoney, eurosToCents, centsToEuros, getCurrencySymbol } from '@/utils/money';
import { calculateGoalPlan } from '@/utils/goalPlan';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SavingsGoalsProps {
  goals: SavingsGoalType[];
  remainingCents: number;
  currency?: string;
  onAddGoal: (goal: { name: string; targetCents: number; savedCents: number; startDate: string; targetDate: string }) => void;
  onAddContribution: (goalId: string, amountCents: number) => void;
  onUpdateGoal: (goalId: string, updates: { name?: string; targetCents?: number; targetDate?: string }) => void;
  onDeleteGoal: (goalId: string) => void;
}

export function SavingsGoals({
  goals,
  remainingCents,
  currency = 'EUR',
  onAddGoal,
  onAddContribution,
  onUpdateGoal,
  onDeleteGoal,
}: SavingsGoalsProps) {
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState(''); // YYYY-MM for input[type="month"]
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [contributeAmount, setContributeAmount] = useState('');

  const suggestedContribution = Math.min(50000, Math.max(0, remainingCents)); // €500 or remaining, whichever is less (cents)

  const handleAddGoal = () => {
    const name = newGoalName.trim();
    const value = parseFloat(newGoalTarget);
    if (!name || isNaN(value) || value <= 0 || !newGoalTargetDate) return;
    const targetDate = `${newGoalTargetDate}-01`; // YYYY-MM -> YYYY-MM-DD
    const startDate = new Date().toISOString().slice(0, 10);
    onAddGoal({
      name,
      targetCents: eurosToCents(value),
      savedCents: 0,
      startDate,
      targetDate,
    });
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalTargetDate('');
    setAddGoalOpen(false);
  };

  const handleContribute = (goalId: string) => {
    const value = parseFloat(contributeAmount);
    if (isNaN(value) || value <= 0) return;
    onAddContribution(goalId, eurosToCents(value));
    setContributeAmount('');
    setContributeGoalId(null);
  };

  const openContribute = (goalId: string) => {
    setContributeGoalId(goalId);
    setContributeAmount((suggestedContribution / 100).toFixed(2));
  };

  const openEdit = (goal: SavingsGoalType) => {
    setEditGoalId(goal.id);
    setEditName(goal.name);
    setEditTarget(centsToEuros(goal.targetCents).toFixed(2));
    setEditTargetDate(goal.targetDate.slice(0, 7)); // YYYY-MM-DD -> YYYY-MM
  };

  const handleSaveEdit = () => {
    if (!editGoalId) return;
    const name = editName.trim();
    const value = parseFloat(editTarget);
    if (!name || isNaN(value) || value <= 0 || !editTargetDate) return;
    onUpdateGoal(editGoalId, {
      name,
      targetCents: eurosToCents(value),
      targetDate: `${editTargetDate}-01`,
    });
    setEditGoalId(null);
    setEditName('');
    setEditTarget('');
    setEditTargetDate('');
  };

  return (
    <div className="card-elevated p-6 animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <Target className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Savings Goals</h2>
            <p className="text-xs text-muted-foreground">Track progress toward your targets</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddGoalOpen(true)}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
          <p className="text-sm text-muted-foreground mb-3">No savings goals yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create a goal and add money to it each month.</p>
          <Button onClick={() => setAddGoalOpen(true)} variant="secondary" size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add your first goal
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {goals.map((goal) => {
            const remaining = Math.max(0, goal.targetCents - goal.savedCents);
            const progressPercent = goal.targetCents > 0
              ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100))
              : 0;
            const plan = calculateGoalPlan(goal);
            const targetDateFormatted = format(parseISO(goal.targetDate), 'MMM yyyy');

            return (
              <div
                key={goal.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{goal.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target: {formatMoney(goal.targetCents, currency)} · Saved: {formatMoney(goal.savedCents, currency)} · Remaining: {formatMoney(remaining, currency)}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        Target date: {targetDateFormatted}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Time left: {plan.monthsRemaining} {plan.monthsRemaining === 1 ? 'month' : 'months'}
                      </p>
                      {plan.monthsRemaining > 0 && (
                        <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 shrink-0" />
                          Recommended saving: {formatMoney(plan.monthlyRequiredSavingCents, currency)} / month
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(goal)}
                      title="Edit goal"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete goal "${goal.name}"?`)) onDeleteGoal(goal.id);
                      }}
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
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
                  onClick={() => openContribute(goal.id)}
                  disabled={remaining <= 0}
                >
                  <Plus className="w-4 h-4" />
                  Add {formatMoney(suggestedContribution, currency)} this month
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add goal dialog */}
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
            <Button variant="outline" onClick={() => setAddGoalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddGoal}
              disabled={!newGoalName.trim() || !newGoalTarget || parseFloat(newGoalTarget) <= 0 || !newGoalTargetDate}
            >
              Add goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit goal dialog */}
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
              <Label htmlFor="edit-goal-target">Target amount ({getCurrencySymbol(currency)})</Label>
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
            <Button variant="outline" onClick={() => setEditGoalId(null)}>Cancel</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editName.trim() || !editTarget || parseFloat(editTarget) <= 0 || !editTargetDate}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add contribution dialog */}
      <Dialog open={!!contributeGoalId} onOpenChange={(open) => !open && setContributeGoalId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add to {contributeGoalId ? goals.find(g => g.id === contributeGoalId)?.name ?? 'goal' : 'goal'} this month
            </DialogTitle>
            <DialogDescription>
              How much do you want to put toward this goal from your remaining budget?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="contribute-amount">Amount ({getCurrencySymbol(currency)})</Label>
              <Input
                id="contribute-amount"
                type="number"
                min="0"
                step="0.01"
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
              />
              {remainingCents >= 0 && (
                <p className="text-xs text-muted-foreground">
                  Remaining this month: {formatMoney(remainingCents, currency)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContributeGoalId(null)}>Cancel</Button>
            {contributeGoalId && (
              <Button
                onClick={() => handleContribute(contributeGoalId)}
                disabled={!contributeAmount || parseFloat(contributeAmount) <= 0}
              >
                Add amount
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
