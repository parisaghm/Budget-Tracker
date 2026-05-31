import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/utils/money";
import {
  DEFAULT_ONBOARDING_DATA,
  ONBOARDING_CATEGORY_OPTIONS,
  type OnboardingCategory,
  type OnboardingData,
  type OnboardingFixedBill,
} from "@/types/onboarding";
import {
  calcSafeToSpend,
  describeOnboardingSafeToSpend,
  getOnboardingBudgetWarnings,
  mergeOnboardingData,
  ONBOARDING_CATEGORY_LABELS,
} from "@/utils/onboarding";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface OnboardingFlowProps {
  initialData?: OnboardingData;
  currency?: string;
  canExit?: boolean;
  onExit?: () => void;
  onComplete: (data: OnboardingData) => Promise<void> | void;
}

const LAST_STEP = 7;

function toCents(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function toMajorUnits(cents: number): string {
  return (Math.max(0, cents) / 100).toString();
}

function createEmptyBill(): OnboardingFixedBill {
  return { id: crypto.randomUUID(), name: "", amountCents: 0 };
}

export function OnboardingFlow({
  initialData = DEFAULT_ONBOARDING_DATA,
  currency = "EUR",
  canExit = false,
  onExit,
  onComplete,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>(() => mergeOnboardingData(initialData));

  useEffect(() => {
    setData(mergeOnboardingData(initialData));
  }, [initialData]);

  const preview = useMemo(() => calcSafeToSpend(data), [data]);
  const budgetWarnings = useMemo(() => getOnboardingBudgetWarnings(data, currency), [data, currency]);
  const safeToSpendExplanation = useMemo(
    () => describeOnboardingSafeToSpend(preview, currency),
    [preview, currency],
  );
  const progress = (step / LAST_STEP) * 100;
  const showBudgetWarnings = step >= 3 && step < 7 && budgetWarnings.length > 0;

  const next = () => {
    if (step === 2 && data.monthlyIncomeCents <= 0) {
      setError("Please add your monthly income to continue.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(LAST_STEP, s + 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const updateBill = (id: string, patch: Partial<OnboardingFixedBill>) => {
    setData((prev) => ({
      ...prev,
      fixedBills: prev.fixedBills.map((bill) => (bill.id === id ? { ...bill, ...patch } : bill)),
    }));
  };

  const removeBill = (id: string) => {
    setData((prev) => ({ ...prev, fixedBills: prev.fixedBills.filter((bill) => bill.id !== id) }));
  };

  const toggleCategory = (category: OnboardingCategory) => {
    setData((prev) => {
      const exists = prev.categories.includes(category);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter((item) => item !== category)
          : [...prev.categories, category],
      };
    });
  };

  const runDemo = () => {
    setData({
      monthlyIncomeCents: 340000,
      fixedBills: [
        { id: crypto.randomUUID(), name: "Rent", amountCents: 120000 },
        { id: crypto.randomUUID(), name: "Phone", amountCents: 3500 },
        { id: crypto.randomUUID(), name: "Subscriptions", amountCents: 1500 },
      ],
      monthlySavingsGoalCents: 30000,
      wantsWeeklyBudget: true,
      preferredWeeklyBudgetCents: 35000,
      categories: ["groceries", "eating_out", "transport", "shopping"],
      completed: false,
      completedAt: null,
    });
    setStep(7);
    setError(null);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (import.meta.env.DEV) {
        console.debug("[onboarding] final payload before submit", {
          monthlyIncomeCents: data.monthlyIncomeCents,
          fixedBills: data.fixedBills,
          monthlySavingsGoalCents: data.monthlySavingsGoalCents,
          wantsWeeklyBudget: data.wantsWeeklyBudget,
          preferredWeeklyBudgetCents: data.preferredWeeklyBudgetCents,
          categories: data.categories,
        });
      }
      await onComplete(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save setup now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step} of {LAST_STEP}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <Card className="card-elevated border-border">
          <CardHeader>
            {step === 1 && (
              <>
                <CardTitle className="text-2xl">Understand your money in 60 seconds</CardTitle>
                <CardDescription>No bank connection. No stress. Just clarity.</CardDescription>
              </>
            )}
            {step === 2 && (
              <>
                <CardTitle>What is your monthly income?</CardTitle>
                <CardDescription>After tax</CardDescription>
              </>
            )}
            {step === 3 && (
              <>
                <CardTitle>What are your fixed monthly costs?</CardTitle>
                <CardDescription>Add rent, phone, subscriptions, or skip this step.</CardDescription>
              </>
            )}
            {step === 4 && (
              <>
                <CardTitle>Do you want to save money each month?</CardTitle>
                <CardDescription>Optional, you can skip.</CardDescription>
              </>
            )}
            {step === 5 && (
              <>
                <CardTitle>Do you want a weekly budget?</CardTitle>
                <CardDescription>Turn it on if you want a weekly spending target.</CardDescription>
              </>
            )}
            {step === 6 && (
              <>
                <CardTitle>Where do you usually spend?</CardTitle>
                <CardDescription>Select your common categories.</CardDescription>
              </>
            )}
            {step === 7 && (
              <>
                <CardTitle>
                  {preview.recommendedWeeklyCents > 0
                    ? `You can safely spend ${formatMoney(preview.recommendedWeeklyCents, currency)} this week`
                    : "Your weekly safe-to-spend is zero right now"}
                </CardTitle>
                <CardDescription>
                  {preview.recommendedWeeklyCents > 0
                    ? "Based on what you shared."
                    : "Your income is fully allocated to bills and savings."}
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 2 && (
              <div className="space-y-2">
                <Label htmlFor="monthlyIncome">Monthly income</Label>
                <Input
                  id="monthlyIncome"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={toMajorUnits(data.monthlyIncomeCents)}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, monthlyIncomeCents: toCents(event.target.value) }))
                  }
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                {data.fixedBills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bills added yet.</p>
                ) : null}
                {data.fixedBills.map((bill) => (
                  <div key={bill.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_160px_auto]">
                    <Input
                      placeholder="Bill name"
                      value={bill.name}
                      onChange={(event) => updateBill(bill.id, { name: event.target.value })}
                    />
                    <Input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={toMajorUnits(bill.amountCents)}
                      onChange={(event) => updateBill(bill.id, { amountCents: toCents(event.target.value) })}
                    />
                    <Button variant="ghost" onClick={() => removeBill(bill.id)}>Remove</Button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => setData((prev) => ({ ...prev, fixedBills: [...prev.fixedBills, createEmptyBill()] }))}>
                  Add bill
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2">
                <Label htmlFor="savingsGoal">Monthly savings goal</Label>
                <Input
                  id="savingsGoal"
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={toMajorUnits(data.monthlySavingsGoalCents)}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, monthlySavingsGoalCents: toCents(event.target.value) }))
                  }
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium">Weekly budget</p>
                    <p className="text-sm text-muted-foreground">Use a weekly spending cap</p>
                  </div>
                  <Switch
                    checked={data.wantsWeeklyBudget}
                    onCheckedChange={(checked) =>
                      setData((prev) => ({
                        ...prev,
                        wantsWeeklyBudget: Boolean(checked),
                        preferredWeeklyBudgetCents: checked
                          ? prev.preferredWeeklyBudgetCents ?? preview.weeklyFromMonthlyCents
                          : null,
                      }))
                    }
                  />
                </div>
                {data.wantsWeeklyBudget ? (
                  <div className="space-y-2">
                    <Label htmlFor="weeklyBudget">Preferred weekly spending limit</Label>
                    <Input
                      id="weeklyBudget"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={toMajorUnits(data.preferredWeeklyBudgetCents ?? 0)}
                      onChange={(event) =>
                        setData((prev) => ({ ...prev, preferredWeeklyBudgetCents: toCents(event.target.value) }))
                      }
                    />
                  </div>
                ) : null}
              </div>
            )}

            {step === 6 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ONBOARDING_CATEGORY_OPTIONS.map((category) => {
                  const checked = data.categories.includes(category);
                  return (
                    <label
                      key={category}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleCategory(category)} />
                      <span>{ONBOARDING_CATEGORY_LABELS[category]}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {step === 7 && (
              <div className="space-y-3">
                {budgetWarnings.map((message) => (
                  <Alert
                    key={message}
                    className="border-amber-500/40 bg-amber-500/10 text-foreground [&>svg]:text-amber-600"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ))}
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Monthly bills</p>
                  <p className="font-semibold">{formatMoney(preview.fixedBillsCents, currency)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Savings</p>
                  <p className="font-semibold">{formatMoney(preview.savingsCents, currency)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Safe to spend (weekly)</p>
                  <p className="text-2xl font-bold">{formatMoney(preview.recommendedWeeklyCents, currency)}</p>
                  {safeToSpendExplanation ? (
                    <p className="mt-2 text-sm text-muted-foreground">{safeToSpendExplanation}</p>
                  ) : null}
                </div>
              </div>
            )}

            {showBudgetWarnings ? (
              <div className="space-y-2">
                {budgetWarnings.map((message) => (
                  <Alert
                    key={message}
                    className="border-amber-500/40 bg-amber-500/10 text-foreground [&>svg]:text-amber-600"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                {step > 1 ? <Button variant="outline" onClick={back}>Back</Button> : null}
                {canExit && step === 1 ? <Button variant="ghost" onClick={onExit}>Cancel</Button> : null}
              </div>
              <div className="flex items-center gap-2">
                {step === 1 ? (
                  <>
                    <Button variant="secondary" onClick={runDemo}>Try demo</Button>
                    <Button onClick={next}>Get started</Button>
                  </>
                ) : null}
                {step === 3 ? (
                  <Button variant="ghost" onClick={next}>Skip</Button>
                ) : null}
                {step === 4 ? (
                  <Button variant="ghost" onClick={next}>Skip</Button>
                ) : null}
                {step > 1 && step < 7 ? <Button onClick={next}>Continue</Button> : null}
                {step === 7 ? (
                  <Button onClick={submit} disabled={saving}>
                    {saving ? "Saving..." : "Go to dashboard"}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
