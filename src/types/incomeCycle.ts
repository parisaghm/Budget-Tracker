/** How often income arrives — drives budget cycle boundaries. */
export type IncomeCyclePreset =
  | "monthly_1"
  | "monthly_15"
  | "monthly_last"
  | "custom";

export interface IncomeCycle {
  preset: IncomeCyclePreset;
  /** Day of month (1–31) when preset is `custom`. */
  day?: number;
}

export const INCOME_CYCLE_PRESET_LABELS: Record<IncomeCyclePreset, string> = {
  monthly_1: "1st of every month",
  monthly_15: "15th of every month",
  monthly_last: "Last day of every month",
  custom: "Custom date",
};

export const INCOME_CYCLE_SETUP_MESSAGE = "Please choose your monthly income date.";

/** Runtime guard for stored JSON (rejects removed weekly / biweekly / last-working-day presets). */
export function isIncomeCyclePreset(value: unknown): value is IncomeCyclePreset {
  return (
    value === "monthly_1" ||
    value === "monthly_15" ||
    value === "monthly_last" ||
    value === "custom"
  );
}
