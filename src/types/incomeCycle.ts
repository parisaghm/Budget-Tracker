/** How often income arrives — drives budget cycle boundaries. */
export type IncomeCyclePreset =
  | "monthly_1"
  | "monthly_15"
  | "monthly_last"
  | "monthly_last_business"
  | "biweekly"
  | "weekly"
  | "custom";

export interface IncomeCycle {
  preset: IncomeCyclePreset;
  /** Day of month (1–31) when preset is `custom`. */
  day?: number;
  /** Last known income date (yyyy-MM-dd) for weekly / biweekly cycles. */
  anchorDate?: string;
}

export const INCOME_CYCLE_PRESET_LABELS: Record<IncomeCyclePreset, string> = {
  monthly_1: "1st of every month",
  monthly_15: "15th of every month",
  monthly_last: "Last day of every month",
  monthly_last_business: "Last working day of every month",
  biweekly: "Every 2 weeks",
  weekly: "Weekly",
  custom: "Custom date",
};

export const INCOME_CYCLE_SETUP_MESSAGE =
  "Set your income date to calculate your budget cycle correctly.";
