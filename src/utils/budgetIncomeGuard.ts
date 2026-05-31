/** Only explicit user income edits (salary setup) may persist salary changes. */
let incomeWriteAllowed = false;

export type IncomeWriteSource = "user_edit" | "onboarding" | "currency_only";

export function runWithIncomeWrite<T>(source: IncomeWriteSource, fn: () => T): T {
  const prev = incomeWriteAllowed;
  const prevSource = currentSource;
  incomeWriteAllowed = true;
  currentSource = source;
  try {
    return fn();
  } finally {
    incomeWriteAllowed = prev;
    currentSource = prevSource;
  }
}

let currentSource: IncomeWriteSource | null = null;

export function canWriteMonthlyIncome(source?: IncomeWriteSource): boolean {
  if (incomeWriteAllowed) return true;
  if (source === "user_edit" || source === "onboarding" || source === "currency_only") return true;
  return false;
}

export function warnBlockedIncomeWrite(
  caller: string,
  attemptedSalaryCents: number,
  currentSalaryCents: number,
): number {
  if (import.meta.env.DEV) {
    console.warn(
      `[budget] Blocked income write from "${caller}" (${attemptedSalaryCents} cents). ` +
        `Monthly income only changes via salary setup. Keeping ${currentSalaryCents} cents.`,
    );
  }
  return currentSalaryCents;
}

export function getIncomeWriteSource(): IncomeWriteSource | null {
  return currentSource;
}
