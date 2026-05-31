import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { IncomeCycle, IncomeCyclePreset } from "@/types/incomeCycle";
import { INCOME_CYCLE_PRESET_LABELS } from "@/types/incomeCycle";
import {
  defaultIncomeAnchorDate,
  formatIncomeDateLabel,
  getNextIncomeDate,
  isIncomeCycleConfigured,
  presetToIncomeCycle,
} from "@/utils/incomeCycle";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const PRESET_ORDER: IncomeCyclePreset[] = [
  "monthly_1",
  "monthly_15",
  "monthly_last",
  "monthly_last_business",
  "biweekly",
  "weekly",
  "custom",
];

interface IncomeCycleSettingsProps {
  value: IncomeCycle | null;
  onChange: (cycle: IncomeCycle | null) => void;
}

export function IncomeCycleSettings({ value, onChange }: IncomeCycleSettingsProps) {
  const [preset, setPreset] = useState<IncomeCyclePreset>(value?.preset ?? "monthly_15");
  const [customDay, setCustomDay] = useState(String(value?.day ?? 1));
  const [anchorDate, setAnchorDate] = useState(value?.anchorDate ?? defaultIncomeAnchorDate());

  useEffect(() => {
    if (!value) return;
    setPreset(value.preset);
    if (value.day != null) setCustomDay(String(value.day));
    if (value.anchorDate) setAnchorDate(value.anchorDate);
  }, [value]);

  const buildCycle = (): IncomeCycle | null => {
    if (preset === "custom") {
      const day = Number.parseInt(customDay, 10);
      if (!Number.isFinite(day) || day < 1 || day > 31) return null;
      return presetToIncomeCycle("custom", day);
    }
    if (preset === "biweekly" || preset === "weekly") {
      if (!anchorDate) return null;
      return presetToIncomeCycle(preset, undefined, anchorDate);
    }
    return presetToIncomeCycle(preset);
  };

  const applyCycle = (nextPreset: IncomeCyclePreset) => {
    setPreset(nextPreset);
    const cycle =
      nextPreset === "custom"
        ? presetToIncomeCycle("custom", Number.parseInt(customDay, 10) || 1)
        : nextPreset === "biweekly" || nextPreset === "weekly"
          ? presetToIncomeCycle(nextPreset, undefined, anchorDate || defaultIncomeAnchorDate())
          : presetToIncomeCycle(nextPreset);
    onChange(isIncomeCycleConfigured(cycle) ? cycle : null);
  };

  const draft = buildCycle();
  const previewCycle = draft && isIncomeCycleConfigured(draft) ? draft : null;
  const nextIncomePreview = previewCycle
    ? formatIncomeDateLabel(getNextIncomeDate(previewCycle))
    : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {PRESET_ORDER.map((option) => {
          const selected = preset === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => applyCycle(option)}
              className={cn(
                "touch-hit rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                selected
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-transparent bg-muted/60 text-foreground hover:bg-muted",
              )}
            >
              {INCOME_CYCLE_PRESET_LABELS[option]}
            </button>
          );
        })}
      </div>

      {preset === "custom" ? (
        <div className="space-y-1.5 rounded-xl bg-muted/60 px-3 py-3">
          <Label htmlFor="income-custom-day" className="text-xs text-muted-foreground">
            Day of month (1–31)
          </Label>
          <Input
            id="income-custom-day"
            type="number"
            min={1}
            max={31}
            value={customDay}
            onChange={(event) => {
              setCustomDay(event.target.value);
              const day = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(day) && day >= 1 && day <= 31) {
                onChange(presetToIncomeCycle("custom", day));
              }
            }}
            className="max-w-[8rem]"
          />
        </div>
      ) : null}

      {preset === "biweekly" || preset === "weekly" ? (
        <div className="space-y-1.5 rounded-xl bg-muted/60 px-3 py-3">
          <Label className="text-xs text-muted-foreground">Last income date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2 font-normal sm:max-w-xs"
              >
                <CalendarIcon className="h-4 w-4 opacity-70" aria-hidden />
                {anchorDate ? format(parseISO(anchorDate), "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={anchorDate ? parseISO(anchorDate) : undefined}
                onSelect={(date) => {
                  if (!date) return;
                  const iso = format(date, "yyyy-MM-dd");
                  setAnchorDate(iso);
                  onChange(presetToIncomeCycle(preset, undefined, iso));
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Used to line up future {preset === "weekly" ? "weekly" : "bi-weekly"} income dates.
          </p>
        </div>
      ) : null}

      {nextIncomePreview ? (
        <p className="text-xs text-muted-foreground">
          Next income date: <span className="font-medium text-foreground">{nextIncomePreview}</span>
        </p>
      ) : null}
    </div>
  );
}
