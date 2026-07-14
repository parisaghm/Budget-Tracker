import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { eurosToCents, centsToEuros, getCurrencySymbol } from "@/utils/money";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CategoryLimitPopoverProps {
  categoryLabel: string;
  currency?: string;
  currentLimitCents: number;
  onSave: (limitCents: number) => void;
  /** Icon-only, text link, or pill button */
  variant?: "icon" | "text" | "button";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CategoryLimitPopover({
  categoryLabel,
  currency = "EUR",
  currentLimitCents,
  onSave,
  variant = "text",
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CategoryLimitPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [inputValue, setInputValue] = useState(
    currentLimitCents > 0 ? String(centsToEuros(currentLimitCents)) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setInputValue(currentLimitCents > 0 ? String(centsToEuros(currentLimitCents)) : "");
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Enter a monthly limit amount.");
      return;
    }
    const euros = parseFloat(trimmed.replace(",", "."));
    if (Number.isNaN(euros) || euros < 0) {
      setError("Enter a valid amount (0 or greater).");
      return;
    }
    setError(null);
    onSave(eurosToCents(euros));
    setOpen(false);
  };

  const hasLimit = currentLimitCents > 0;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-secondary/60 text-foreground transition-colors hover:bg-secondary",
              className,
            )}
            aria-label={hasLimit ? `Edit ${categoryLabel} limit` : `Set ${categoryLabel} limit`}
          >
            <Pencil className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </button>
        ) : variant === "button" ? (
          <button
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-secondary",
              className,
            )}
          >
            <Pencil className="h-3 w-3 opacity-70" aria-hidden />
            Edit limit
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline",
              className,
            )}
          >
            <Plus className="h-3 w-3" aria-hidden />
            {hasLimit ? "Edit limit" : "Set limit"}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium text-foreground">{categoryLabel} — monthly limit</p>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 600"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError(null);
              }}
              className="font-mono"
              aria-invalid={error != null}
            />
            <span className="self-center text-sm text-muted-foreground">
              {getCurrencySymbol(currency)}
            </span>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1 rounded-full">
              Save
            </Button>
            {hasLimit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  onSave(0);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
