import { useEffect, useState } from "react";
import type { BillFrequency, BillStatus, CategoryDef, RecurringBill } from "@/types/finance";
import { eurosToCents, getCurrencySymbol } from "@/utils/money";
import { BILL_FREQUENCY_OPTIONS } from "@/utils/recurringBills";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingBill) {
      setName(editingBill.name);
      setAmount((editingBill.amountCents / 100).toFixed(2));
      setCategory(editingBill.category);
      setDueDate(editingBill.nextDueDate);
      setFrequency(editingBill.frequency);
      setStatus(editingBill.status);
      setNote(editingBill.note ?? "");
      return;
    }
    setName("");
    setAmount("");
    setCategory(categories[0]?.value ?? "other");
    setDueDate(new Date().toISOString().slice(0, 10));
    setFrequency("monthly");
    setStatus("upcoming");
    setNote("");
  }, [open, editingBill, categories]);

  const handleSubmit = async () => {
    const amountNumber = Number(amount);
    if (!name.trim() || !amount || Number.isNaN(amountNumber) || amountNumber <= 0 || !dueDate) return;
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
            <select
              id="bill-category"
              className="input-clean min-h-12 text-base"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-due-date" className="text-sm font-medium">
              Due date
            </Label>
            <Input
              id="bill-due-date"
              className="h-12 text-base"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-frequency" className="text-sm font-medium">
              Repeat frequency
            </Label>
            <select
              id="bill-frequency"
              className="input-clean min-h-12 text-base"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as BillFrequency)}
            >
              {BILL_FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-status" className="text-sm font-medium">
              Payment status
            </Label>
            <select
              id="bill-status"
              className="input-clean min-h-12 text-base"
              value={status}
              onChange={(e) => setStatus(e.target.value as BillStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            disabled={isSaving || !name.trim() || !amount}
          >
            {isSaving ? "Saving…" : editingBill ? "Save changes" : "Add bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
