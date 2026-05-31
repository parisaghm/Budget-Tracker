import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import type { BillFrequency, BillStatus, CategoryDef, RecurringBill } from "@/types/finance";
import { eurosToCents, getCurrencySymbol } from "@/utils/money";
import { BILL_FREQUENCY_OPTIONS, getBillSeriesEndDate } from "@/utils/recurringBills";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYmdToLocalDate(ymd: string): Date | undefined {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(y, mo - 1, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== day) return undefined;
  return dt;
}

const selectTriggerClass =
  "input-clean h-12 min-h-12 text-base rounded-xl focus:ring-2 focus:ring-ring/30 focus:ring-offset-0";
const overlayContentClass = "z-[60]";

type BillInput = Omit<RecurringBill, "id" | "userId" | "createdAt" | "updatedAt" | "lastPaidDate" | "amountCents"> & {
  amountCents: number;
  lastPaidDate?: string;
};

interface RecurringBillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryDef[];
  currency?: string;
  editingBill?: RecurringBill | null;
  onSubmit: (bill: BillInput) => Promise<void> | void;
}

const STATUS_OPTIONS: Array<{ value: BillStatus; label: string }> = [
  { value: "upcoming", label: "Upcoming" },
  { value: "paid", label: "Paid" },
  { value: "skipped", label: "Skipped" },
];

type DurationMode = "ongoing" | "fixed";

export function RecurringBillForm({
  open,
  onOpenChange,
  categories,
  currency = "EUR",
  editingBill,
  onSubmit,
}: RecurringBillFormProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]?.value ?? "other");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState<BillFrequency>("monthly");
  const [status, setStatus] = useState<BillStatus>("upcoming");
  const [note, setNote] = useState("");
  const [durationMode, setDurationMode] = useState<DurationMode>("ongoing");
  const [paymentCount, setPaymentCount] = useState("5");
  const [isSaving, setIsSaving] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const selectedDueDate = useMemo(() => parseYmdToLocalDate(dueDate), [dueDate]);
  const parsedPaymentCount = Number(paymentCount);
  const seriesEndPreview = useMemo(() => {
    if (durationMode !== "fixed" || !dueDate || Number.isNaN(parsedPaymentCount) || parsedPaymentCount < 1) {
      return null;
    }
    return getBillSeriesEndDate(dueDate, frequency, Math.floor(parsedPaymentCount));
  }, [durationMode, dueDate, frequency, parsedPaymentCount]);

  useEffect(() => {
    if (!open) {
      setDatePickerOpen(false);
      return;
    }
    if (editingBill) {
      setName(editingBill.name);
      setAmount((editingBill.amountCents / 100).toFixed(2));
      setCategory(editingBill.category);
      setDueDate(editingBill.nextDueDate);
      setFrequency(editingBill.frequency);
      setStatus(editingBill.status);
      setNote(editingBill.note ?? "");
      setDurationMode(editingBill.paymentCount ? "fixed" : "ongoing");
      setPaymentCount(String(editingBill.paymentCount ?? 5));
      return;
    }
    setName("");
    setAmount("");
    setCategory(categories[0]?.value ?? "other");
    setDueDate(new Date().toISOString().slice(0, 10));
    setFrequency("monthly");
    setStatus("upcoming");
    setNote("");
    setDurationMode("ongoing");
    setPaymentCount("5");
  }, [open, editingBill, categories]);

  const handleSubmit = async () => {
    const amountNumber = Number(amount);
    const fixedCount =
      durationMode === "fixed" && !Number.isNaN(parsedPaymentCount)
        ? Math.floor(parsedPaymentCount)
        : null;
    if (
      !name.trim() ||
      !amount ||
      Number.isNaN(amountNumber) ||
      amountNumber <= 0 ||
      !dueDate ||
      (durationMode === "fixed" && (fixedCount == null || fixedCount < 1))
    ) {
      return;
    }
    setIsSaving(true);
    try {
      await Promise.resolve(
        onSubmit({
          name: name.trim(),
          amountCents: eurosToCents(amountNumber),
          category,
          dueDay: Number(dueDate.slice(-2)),
          frequency,
          status,
          nextDueDate: dueDate,
          seriesStartDate:
            durationMode === "fixed" && editingBill?.seriesStartDate
              ? editingBill.seriesStartDate
              : dueDate,
          paymentCount: durationMode === "fixed" ? fixedCount! : null,
          paymentsCompleted: editingBill?.paymentsCompleted ?? 0,
          note: note.trim() || undefined,
          lastPaidDate: status === "paid" ? new Date().toISOString().slice(0, 10) : undefined,
        }),
      );
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,100dvh-1rem)] w-[calc(100vw-1.25rem)] max-w-lg gap-0 overflow-y-auto overscroll-contain rounded-2xl p-4 pt-6 sm:w-full sm:p-6">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-xl font-semibold">
            {editingBill ? "Edit recurring bill" : "Add recurring bill"}
          </DialogTitle>
          <DialogDescription className="text-base sm:text-sm">
            Rent, subscriptions, or other regular payments—kept simple.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="bill-name" className="text-sm font-medium">
              Bill name
            </Label>
            <Input
              id="bill-name"
              className="h-12 text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rent"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-amount" className="text-sm font-medium">
              Amount ({getCurrencySymbol(currency)})
            </Label>
            <Input
              id="bill-amount"
              className="h-12 text-base"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1200"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-category" className="text-sm font-medium">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="bill-category" className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={overlayContentClass}>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-due-date" className="text-sm font-medium">
              Due date
            </Label>
            <button
              id="bill-due-date"
              type="button"
              disabled={isSaving}
              aria-expanded={datePickerOpen}
              aria-haspopup="dialog"
              onClick={() => setDatePickerOpen((open) => !open)}
              className={cn(
                selectTriggerClass,
                "flex w-full items-center justify-between gap-2 text-left font-normal",
                !dueDate && "text-muted-foreground",
              )}
            >
              <span>
                {selectedDueDate
                  ? selectedDueDate.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })
                  : "Pick a day"}
              </span>
              <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
            </button>
            {datePickerOpen && (
              <div
                className="mt-2 w-fit max-w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
                role="dialog"
                aria-label="Choose due date"
              >
                <Calendar
                  mode="single"
                  selected={selectedDueDate}
                  onSelect={(d) => {
                    if (!d) return;
                    setDueDate(localYmd(d));
                    setDatePickerOpen(false);
                  }}
                  defaultMonth={selectedDueDate ?? new Date()}
                  initialFocus
                />
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-frequency" className="text-sm font-medium">
              Repeat frequency
            </Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as BillFrequency)}>
              <SelectTrigger id="bill-frequency" className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={overlayContentClass}>
                {BILL_FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-duration" className="text-sm font-medium">
              How long does this bill run?
            </Label>
            <Select value={durationMode} onValueChange={(v) => setDurationMode(v as DurationMode)}>
              <SelectTrigger id="bill-duration" className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={overlayContentClass}>
                <SelectItem value="ongoing">Keeps going (no end date)</SelectItem>
                <SelectItem value="fixed">Fixed number of payments</SelectItem>
              </SelectContent>
            </Select>
            {durationMode === "fixed" ? (
              <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/30 p-3">
                <Label htmlFor="bill-payment-count" className="text-sm font-medium">
                  Number of payments
                </Label>
                <Input
                  id="bill-payment-count"
                  className="h-12 text-base"
                  type="number"
                  min={1}
                  max={240}
                  inputMode="numeric"
                  value={paymentCount}
                  onChange={(e) => setPaymentCount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {frequency === "monthly"
                    ? "For monthly bills, 5 payments usually means about five months."
                    : "Each payment follows your repeat frequency until the count is reached."}
                  {seriesEndPreview ? (
                    <>
                      {" "}
                      Last payment around{" "}
                      {parseYmdToLocalDate(seriesEndPreview)?.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      .
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-status" className="text-sm font-medium">
              Payment status
            </Label>
            <Select value={status} onValueChange={(v) => setStatus(v as BillStatus)}>
              <SelectTrigger id="bill-status" className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={overlayContentClass}>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-note" className="text-sm font-medium">
              Note (optional)
            </Label>
            <Input
              id="bill-note"
              className="h-12 text-base"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Annual contract"
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full touch-manipulation sm:h-10 sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-12 w-full touch-manipulation sm:h-10 sm:w-auto"
            onClick={handleSubmit}
            disabled={
              isSaving ||
              !name.trim() ||
              !amount ||
              (durationMode === "fixed" && (Number.isNaN(parsedPaymentCount) || parsedPaymentCount < 1))
            }
          >
            {isSaving ? "Saving…" : editingBill ? "Save changes" : "Add bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
