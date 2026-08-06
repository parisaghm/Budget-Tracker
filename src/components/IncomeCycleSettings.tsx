import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { IncomeCycle, IncomeCyclePreset } from "@/types/incomeCycle";
import { isIncomeCycleConfigured, presetToIncomeCycle } from "@/utils/incomeCycle";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_ORDER: IncomeCyclePreset[] = [
  "monthly_1",
  "monthly_15",
  "monthly_last",
  "custom",
];

const PRESET_CARDS: Record<
  IncomeCyclePreset,
  { title: string; description: string }
> = {
  monthly_1: { title: "1st of month", description: "Classic monthly" },
  monthly_15: { title: "15th of month", description: "Mid-month payday" },
  monthly_last: { title: "Last day", description: "End-of-month pay" },
  custom: { title: "Custom day", description: "Any day you choose" },
};

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

  const applyCycle = (nextPreset: IncomeCyclePreset) => {
    setPreset(nextPreset);
    const cycle =
      nextPreset === "custom"
        ? presetToIncomeCycle("custom", Number.parseInt(customDay, 10) || 1)
        : presetToIncomeCycle(nextPreset);
    onChange(isIncomeCycleConfigured(cycle) ? cycle : null);
  };

  return (
    <div className="space-y-3">
      <p className="label-caps text-muted-foreground">When does your cycle start?</p>
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Cycle start"
      >
        {PRESET_ORDER.map((option) => {
          const selected = preset === option;
          const card = PRESET_CARDS[option];
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => applyCycle(option)}
              className={cn(
                "touch-hit relative rounded-xl border px-3 py-3 text-left transition-colors",
                selected
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-transparent bg-muted/60 text-foreground hover:bg-muted",
              )}
            >
              <p className="text-sm font-semibold">{card.title}</p>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  selected ? "text-primary/80" : "text-muted-foreground",
                )}
              >
                {card.description}
              </p>
              {selected ? (
                <span
                  className="absolute bottom-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  aria-hidden
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
              ) : null}
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
          <p className="text-xs text-muted-foreground">
            Shorter months use the last valid day automatically.
          </p>
        </div>
      ) : null}
    </div>
  );
}
