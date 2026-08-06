import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryEmojiIcon } from "@/components/icons/CategoryEmojiIcon";
import type { Category, CategoryDef, Expense } from "@/types/finance";
import { centsToEuros, eurosToCents, getCurrencySymbol, getTodayDate, toDateInputValue } from "@/utils/money";
import { cn } from "@/lib/utils";

export type ExpenseFormMode = "closed" | "adding" | "editing";

export type ExpenseInlineSubmitPayload = {
  amountCents: number;
  category: Category;
  note: string;
  /** Transaction date YYYY-MM-DD (local calendar). */
  date: string;
  expenseId?: string;
};

type FieldErrors = {
  note?: string;
  amount?: string;
  category?: string;
  date?: string;
  form?: string;
};

interface ExpenseInlineFormProps {
  mode: "adding" | "editing";
  initialExpense?: Expense | null;
  /**
   * YYYY-MM-DD for new expenses — computed when the form opens (local today
   * inside the selected cycle). Ignored while editing.
   */
  defaultTransactionDate?: string;
  categories: CategoryDef[];
  currency: string;
  isPending?: boolean;
  onSubmit: (payload: ExpenseInlineSubmitPayload) => void | Promise<void>;
  onCancel: () => void;
  className?: string;
}

function amountToInputValue(cents: number | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  return centsToEuros(cents).toFixed(2);
}

function parseAmountInput(raw: string): { ok: true; cents: number } | { ok: false } {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return { ok: false };
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return { ok: false };
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0) return { ok: false };
  const cents = eurosToCents(value);
  if (cents <= 0) return { ok: false };
  return { ok: true, cents };
}

function buildInitialState(
  mode: "adding" | "editing",
  initialExpense: Expense | null | undefined,
  knownCategoryValues: Set<string>,
  defaultTransactionDate: string | undefined,
) {
  if (mode === "editing" && initialExpense) {
    return {
      note: initialExpense.note ?? "",
      amount: amountToInputValue(initialExpense.amountCents),
      category: knownCategoryValues.has(initialExpense.category)
        ? (initialExpense.category as Category)
        : ("" as const),
      // Preserve the original transaction date unless the user changes it later.
      date: toDateInputValue(initialExpense.date) || getTodayDate(),
    };
  }
  return {
    note: "",
    amount: "",
    category: "" as const,
    // Fresh local calendar day at open — never reuse a prior expense's date.
    date: toDateInputValue(defaultTransactionDate) || getTodayDate(),
  };
}

export function ExpenseInlineForm({
  mode,
  initialExpense = null,
  defaultTransactionDate,
  categories,
  currency,
  isPending = false,
  onSubmit,
  onCancel,
  className,
}: ExpenseInlineFormProps) {
  const formId = useId();
  const noteRef = useRef<HTMLInputElement>(null);
  const currencySymbol = getCurrencySymbol(currency);

  const knownCategoryValues = useMemo(
    () => new Set(categories.map((c) => c.value)),
    [categories],
  );

  // Parent remounts this form with a mode/expense key so values initialize once.
  const seed = buildInitialState(mode, initialExpense, knownCategoryValues, defaultTransactionDate);
  const [note, setNote] = useState(seed.note);
  const [amount, setAmount] = useState(seed.amount);
  const [category, setCategory] = useState<Category | "">(seed.category);
  const [date, setDate] = useState(seed.date);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      noteRef.current?.focus();
      const el = noteRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Run once on mount (parent keys remounts per add/edit target).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only focus
  }, []);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    // Allow empty note so existing "Untitled expense" rows remain editable.
    // For add mode, still require a merchant/description.
    if (mode === "adding" && !note.trim()) {
      next.note = "Enter where you spent the money.";
    }

    const parsed = parseAmountInput(amount);
    if (!parsed.ok) {
      next.amount = `Enter an amount greater than ${currencySymbol}0.00.`;
    }

    if (!category || !knownCategoryValues.has(category)) {
      next.category = "Choose a category.";
    }

    if (!toDateInputValue(date)) {
      next.date = "Choose a date.";
    }

    return next;
  };

  const validation = validate();
  const isValid = Object.keys(validation).length === 0;
  const fieldErrors = showErrors ? validation : errors;
  const selectedCategory = categories.find((c) => c.value === category);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (isPending) return;

    const nextErrors = validate();
    setShowErrors(true);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const parsed = parseAmountInput(amount);
    if (!parsed.ok || !category) return;

    const transactionDate = toDateInputValue(date) || getTodayDate();

    try {
      await Promise.resolve(
        onSubmit({
          amountCents: parsed.cents,
          category,
          note: note.trim(),
          date: transactionDate,
          expenseId: mode === "editing" ? initialExpense?.id : undefined,
        }),
      );
      // Parent closes/remounts on success; reset date here for any reuse path.
      if (mode === "adding") {
        setDate(toDateInputValue(defaultTransactionDate) || getTodayDate());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save expense.";
      setErrors((prev) => ({ ...prev, form: message }));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!isPending) onCancel();
    }
  };

  const isEditing = mode === "editing";
  const noteErrorId = `${formId}-note-error`;
  const amountErrorId = `${formId}-amount-error`;
  const categoryErrorId = `${formId}-category-error`;
  const dateErrorId = `${formId}-date-error`;
  const formErrorId = `${formId}-form-error`;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      onKeyDown={handleKeyDown}
      className={cn(
        "rounded-2xl border border-border bg-card/80 p-3.5 sm:p-4",
        className,
      )}
      aria-label={isEditing ? "Edit expense" : "Add expense"}
      noValidate
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_7.5rem_11rem_9.5rem] md:items-start">
        <div className="min-w-0 sm:col-span-2 md:col-span-1">
          <label htmlFor={`${formId}-note`} className="sr-only">
            Merchant or description
          </label>
          <input
            ref={noteRef}
            id={`${formId}-note`}
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (errors.note) setErrors((prev) => ({ ...prev, note: undefined }));
            }}
            placeholder="Where? e.g. K-Market"
            autoComplete="off"
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.note)}
            aria-describedby={fieldErrors.note ? noteErrorId : undefined}
            className={cn(
              "h-11 w-full rounded-xl border bg-popover px-3.5 text-sm text-foreground placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              "disabled:cursor-not-allowed disabled:opacity-60",
              fieldErrors.note ? "border-destructive/50" : "border-border",
            )}
          />
          {fieldErrors.note ? (
            <p id={noteErrorId} className="mt-1.5 text-xs text-destructive" role="alert">
              {fieldErrors.note}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${formId}-amount`} className="sr-only">
            Amount
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground"
              aria-hidden
            >
              {currencySymbol}
            </span>
            <input
              id={`${formId}-amount`}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d.,]/g, "");
                setAmount(next);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              placeholder="0.00"
              autoComplete="off"
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.amount)}
              aria-describedby={fieldErrors.amount ? amountErrorId : undefined}
              className={cn(
                "h-11 w-full rounded-xl border bg-popover py-2 pl-8 pr-3 text-right text-sm tabular-nums text-foreground placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                "disabled:cursor-not-allowed disabled:opacity-60",
                fieldErrors.amount ? "border-destructive/50" : "border-border",
              )}
            />
          </div>
          {fieldErrors.amount ? (
            <p id={amountErrorId} className="mt-1.5 text-xs text-destructive" role="alert">
              {fieldErrors.amount}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${formId}-category`} className="sr-only">
            Category
          </label>
          {categories.length === 0 ? (
            <div className="flex h-11 items-center rounded-xl border border-border bg-popover px-3 text-sm text-muted-foreground">
              No categories ·{" "}
              <Link to="/budget" className="ml-1 font-medium text-primary underline-offset-2 hover:underline">
                Set budgets
              </Link>
            </div>
          ) : (
            <div className="relative">
              <select
                id={`${formId}-category`}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
                }}
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.category)}
                aria-describedby={fieldErrors.category ? categoryErrorId : undefined}
                className={cn(
                  "h-11 w-full appearance-none rounded-xl border bg-popover py-2 pl-10 pr-9 text-sm text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  fieldErrors.category
                    ? "border-destructive/50"
                    : category
                      ? "border-primary/45"
                      : "border-border",
                )}
              >
                <option value="" disabled>
                  Category
                </option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                {selectedCategory ? (
                  <CategoryEmojiIcon
                    categoryValue={selectedCategory.value}
                    iconKey={selectedCategory.iconKey}
                    label={selectedCategory.label}
                    decorative
                    className="h-6 w-6 rounded-md"
                    iconClassName="h-3.5 w-3.5"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                    ?
                  </span>
                )}
              </span>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
          )}
          {fieldErrors.category ? (
            <p id={categoryErrorId} className="mt-1.5 text-xs text-destructive" role="alert">
              {fieldErrors.category}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${formId}-date`} className="sr-only">
            Date
          </label>
          <input
            id={`${formId}-date`}
            type="date"
            value={date}
            onChange={(e) => {
              setDate(toDateInputValue(e.target.value) || e.target.value);
              if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
            }}
            disabled={isPending}
            aria-invalid={Boolean(fieldErrors.date)}
            aria-describedby={fieldErrors.date ? dateErrorId : undefined}
            className={cn(
              "h-11 w-full rounded-xl border bg-popover px-3 text-sm tabular-nums text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              "disabled:cursor-not-allowed disabled:opacity-60",
              fieldErrors.date ? "border-destructive/50" : "border-border",
            )}
          />
          {fieldErrors.date ? (
            <p id={dateErrorId} className="mt-1.5 text-xs text-destructive" role="alert">
              {fieldErrors.date}
            </p>
          ) : null}
        </div>
      </div>

      {errors.form ? (
        <p id={formErrorId} className="mt-3 text-sm text-destructive" role="alert">
          {errors.form}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={isPending || !isValid || categories.length === 0}
          className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-semibold hover:bg-primary/90 sm:w-auto disabled:opacity-60"
        >
          {isPending ? "Saving…" : isEditing ? "Save changes" : "Save expense"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onCancel}
          className="h-11 w-full rounded-xl border-border bg-popover px-5 text-sm font-semibold text-foreground hover:bg-card sm:w-auto"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
