import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { CategoryDef } from "@/types/finance";
import { defaultExpenseDateForBudgetMonth, eurosToCents, getCurrencySymbol, getTodayDate } from "@/utils/money";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface QuickAddExpenseSheetProps {
  currency?: string;
  categories: CategoryDef[];
  /** YYYY-MM for the budget month new expenses are posted to */
  budgetMonth?: string;
  onAdd: (expense: { amountCents: number; category: string; date: string; note: string }) => Promise<void> | void;
}

export function QuickAddExpenseSheet({ currency = "EUR", categories, budgetMonth, onAdd }: QuickAddExpenseSheetProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]?.value ?? "other");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit = useMemo(() => Number(amount) > 0 && !isSaving, [amount, isSaving]);

  useEffect(() => {
    if (!categories.length) return;
    if (!categories.some((c) => c.value === category)) {
      setCategory(categories[0]!.value);
    }
  }, [categories, category]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setIsSaving(true);
    try {
      const expenseDate =
        budgetMonth?.trim() ? defaultExpenseDateForBudgetMonth(budgetMonth) : getTodayDate();
      await Promise.resolve(
        onAdd({
          amountCents: eurosToCents(parsed),
          category,
          date: expenseDate,
          note: note.trim(),
        }),
      );
      setOpen(false);
      setAmount("");
      setNote("");
      toast.success("Expense added");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Could not add expense", { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          size="icon"
          className={cn(
            "touch-hit fixed right-4 z-50 h-16 w-16 rounded-full border border-primary/20 shadow-lg shadow-primary/25 md:hidden",
            "bottom-mobile-fab",
          )}
          aria-label="Quick add expense"
        >
          <Plus className="h-7 w-7" strokeWidth={2.25} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[min(92vh,calc(100dvh-1rem))] rounded-t-3xl border-border/70 bg-background px-0">
        <DrawerHeader className="px-5 pb-2 pt-1 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">Quick add</DrawerTitle>
          <DrawerDescription className="text-base text-muted-foreground">
            Log a purchase in a few taps.
          </DrawerDescription>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[min(72vh,520px)] flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                {getCurrencySymbol(currency)}
              </span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="input-clean h-16 pl-12 text-2xl font-semibold tabular-nums"
                required
                autoComplete="transaction-amount"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category
            </label>
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "touch-hit shrink-0 snap-start rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                    category === cat.value
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Coffee, groceries…"
              className="input-clean min-h-[52px] text-base"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={!canSubmit} className="h-14 w-full shrink-0 text-base font-semibold">
            {isSaving ? "Saving…" : "Add expense"}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
