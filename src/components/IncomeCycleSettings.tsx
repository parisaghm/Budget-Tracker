import { useEffect, useState } from "react";
import type { IncomeCycle, IncomeCyclePreset } from "@/types/incomeCycle";
import { INCOME_CYCLE_PRESET_LABELS } from "@/types/incomeCycle";
import {
  formatIncomeDateLabel,
  getNextIncomeDate,
  isIncomeCycleConfigured,
  presetToIncomeCycle,
} from "@/utils/incomeCycle";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_ORDER: IncomeCyclePreset[] = [
  "monthly_1",
  "monthly_15",
  "monthly_last",
  "custom",
];

interface IncomeCycleSettingsProps {
  value: IncomeCycle | null;
  onChange: (cycle: IncomeCycle | null) => void;
}

export function IncomeCycleSettings({ value, onChange }: IncomeCycleSettingsProps) {
  const [preset, setPreset] = useState<IncomeCyclePreset | null>(value?.preset ?? null);
  const [customDay, setCustomDay] = useState(String(value?.day ?? 1));

  useEffect(() => {
    if (!value) {
      setPreset(null);
      return;
    }
    setPreset(value.preset);
    if (value.day != null) setCustomDay(String(value.day));
  }, [value]);

  const buildCycle = (): IncomeCycle | null => {
    if (!preset) return null;
    if (preset === "custom") {
      const day = Number.parseInt(customDay, 10);
      if (!Number.isFinite(day) || day < 1 || day > 31) return null;
      return presetToIncomeCycle("custom", day);
    }
    return presetToIncomeCycle(preset);
  };

  const applyCycle = (nextPreset: IncomeCyclePreset) => {
    setPreset(nextPreset);
    const cycle =
      nextPreset === "custom"
        ? presetToIncomeCycle("custom", Number.parseInt(customDay, 10) || 1)
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

      {nextIncomePreview ? (
        <p className="text-xs text-muted-foreground">
          Next income date: <span className="font-medium text-foreground">{nextIncomePreview}</span>
        </p>
      ) : null}
    </div>
  );
}
