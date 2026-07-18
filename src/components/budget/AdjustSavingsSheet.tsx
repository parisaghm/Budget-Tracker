import { AlertCircle, Loader2, Lock, X } from "lucide-react";
import type { useAdjustSavingsDecision } from "@/hooks/useAdjustSavingsDecision";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatMoney, getCurrencySymbol } from "@/utils/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AdjustSavingsSheetProps = ReturnType<typeof useAdjustSavingsDecision> & {
  currency: string;
  cycleLabel: string;
};

function AdjustSavingsContent({
  currency,
  cycleLabel,
  setOpen,
  isSaving,
  reductionInput,
  setReductionInput,
  selectedQuickOption,
  applyQuickOption,
  deficitCents,
  activeSavingsContributionCents,
  maxReductionCents,
  reductionCents,
  projection,
  reductionError,
  canConfirm,
  applyAdjustment,
}: AdjustSavingsSheetProps) {
  const currencySymbol = getCurrencySymbol(currency);

  const quickOptions = [
    {
      id: "deficit" as const,
      label: "Cover deficit",
      amountCents: Math.min(deficitCents, maxReductionCents),
    },
    {
      id: "buffer50" as const,
      label: "Leave €50 buffer",
      amountCents: Math.min(deficitCents + 5000, maxReductionCents),
    },
    {
      id: "buffer100" as const,
      label: "Leave €100 buffer",
      amountCents: Math.min(deficitCents + 10000, maxReductionCents),
    },
  ];

  return (
    <div className={cn("adjust-savings-sheet", isSaving && "adjust-savings-sheet--saving")}>
      {isSaving ? (
        <div className="adjust-savings-sheet__loading" role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin text-[#6E4E91]" aria-hidden />
          <span className="text-sm font-medium text-[#2B221B]">Adjusting savings...</span>
        </div>
      ) : null}

      <div className={cn("adjust-savings-sheet__body", isSaving && "adjust-savings-sheet__body--dimmed")}>
      <div className="adjust-savings-sheet__header">
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#1A1411]">
          Adjust savings
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isSaving}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#746A5D] transition-colors hover:bg-[#EFE7F7]/60 hover:text-[#1A1411] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6E4E91]/30 disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="adjust-savings-sheet__alert" role="status">
        <AlertCircle className="h-4 w-4 shrink-0 text-[#9C5A56]" aria-hidden />
        <p className="text-sm leading-relaxed text-[#2B221B]">
          You&apos;re {formatMoney(deficitCents, currency)} over your available budget this cycle.
          Reducing this month&apos;s savings contribution can bring your Safe to Spend back to{" "}
          {formatMoney(0, currency)}.
        </p>
      </div>

      <div className="adjust-savings-sheet__summary">
        <div className="adjust-savings-sheet__summary-row">
          <span className="text-sm text-[#746A5D]">Current savings contribution</span>
          <span className="money-amount-sm text-sm text-[#1A1411]">
            {formatMoney(activeSavingsContributionCents, currency)}
          </span>
        </div>
        <div className="adjust-savings-sheet__summary-row">
          <span className="text-sm text-[#746A5D]">Recommended reduction</span>
          <span className="money-amount-sm text-sm text-[#9C5A56]">
            −{formatMoney(reductionCents > 0 ? reductionCents : Math.min(deficitCents, maxReductionCents), currency)}
          </span>
        </div>
        <div className="adjust-savings-sheet__summary-row">
          <span className="text-sm text-[#746A5D]">New savings contribution</span>
          <span className="money-amount-sm text-sm text-[#1A1411]">
            {formatMoney(projection.newSavingsContributionCents, currency)}
          </span>
        </div>
        <div className="adjust-savings-sheet__summary-row adjust-savings-sheet__summary-row--total">
          <span className="text-sm font-medium text-[#2B221B]">New Safe to Spend</span>
          <span
            className={cn(
              "money-display-md text-base",
              projection.newSafeToSpendCents >= 0 ? "text-[#4A5C40]" : "text-[#9C5A56]",
            )}
          >
            {formatMoney(projection.newSafeToSpendCents, currency)}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="adjust-savings-amount" className="text-sm font-medium text-[#2B221B]">
          Reduce savings by
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#746A5D]">
            {currencySymbol}
          </span>
          <Input
            id="adjust-savings-amount"
            type="number"
            min="0"
            step="0.01"
            max={maxReductionCents > 0 ? maxReductionCents / 100 : undefined}
            value={reductionInput}
            onChange={(e) => setReductionInput(e.target.value)}
            disabled={isSaving}
            className="h-11 rounded-xl border-[#E8DFCC] bg-[#FFFDF8] pl-8 text-base"
            inputMode="decimal"
          />
        </div>
        <p className="text-xs text-[#746A5D]">
          Enter any amount up to {formatMoney(maxReductionCents, currency)}
        </p>
        {reductionError ? (
          <p className="text-xs text-destructive">{reductionError}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#746A5D]">
          Quick options
        </p>
        <div className="flex flex-wrap gap-2">
          {quickOptions.map((option) => {
            const disabled = option.amountCents <= 0 || option.amountCents > maxReductionCents;
            const isActive = selectedQuickOption === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled || isSaving}
                onClick={() => applyQuickOption(option.id)}
                className={cn(
                  "adjust-savings-quick-option",
                  isActive && "adjust-savings-quick-option--active",
                )}
              >
                <span className="block text-xs font-medium">{option.label}</span>
                <span className="money-amount-sm mt-0.5 block text-[11px]">
                  {formatMoney(option.amountCents, currency)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="adjust-savings-sheet__footer">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-full border-[#E8DFCC] bg-[#FFFDF8]"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 rounded-full bg-[#6E4E91] hover:bg-[#5C4580]"
            disabled={!canConfirm || isSaving}
            onClick={() => void applyAdjustment()}
          >
            {isSaving ? "Adjusting savings..." : "Confirm adjustment"}
          </Button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#746A5D]">
          <Lock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          Only affects your current cycle ({cycleLabel.replace(" (current cycle)", "")}).
        </p>
      </div>
      </div>
    </div>
  );
}

export function AdjustSavingsSheet(props: AdjustSavingsSheetProps) {
  const isMobile = useIsMobile();
  const { open, setOpen, isSaving } = props;

  const handleOpenChange = (next: boolean) => {
    if (isSaving && !next) return;
    setOpen(next);
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[92vh] rounded-t-[1.5rem] border-[#E8DFCC] bg-[#FFFDF8] px-0 pb-6">
          <DrawerTitle className="sr-only">Adjust savings</DrawerTitle>
          <div className="overflow-y-auto px-4 pb-2 pt-1">
            <AdjustSavingsContent {...props} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[1.5rem] border-[#E8DFCC] bg-[#FFFDF8] p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Adjust savings</DialogTitle>
        <div className="p-6">
          <AdjustSavingsContent {...props} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
