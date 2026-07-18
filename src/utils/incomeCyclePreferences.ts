import { isIncomeCyclePreset, type IncomeCycle } from "@/types/incomeCycle";
import { isIncomeCycleConfigured } from "@/utils/incomeCycle";

export const INCOME_CYCLE_STORAGE_KEY = "bt_income_cycle_v1";

function storageKeyForUser(userId: string): string {
  return `${INCOME_CYCLE_STORAGE_KEY}:${userId}`;
}

export function readIncomeCycle(userId: string | undefined): IncomeCycle | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { preset?: unknown; day?: unknown };
    // Deprecated presets resolve to null (unselected) without wiping stored data here.
    if (!isIncomeCyclePreset(parsed.preset)) return null;
    const cycle: IncomeCycle = {
      preset: parsed.preset,
      day: typeof parsed.day === "number" ? parsed.day : undefined,
    };
    return isIncomeCycleConfigured(cycle) ? cycle : null;
  } catch {
    return null;
  }
}

export function writeIncomeCycle(userId: string, cycle: IncomeCycle | null): void {
  if (!cycle || !isIncomeCycleConfigured(cycle)) {
    localStorage.removeItem(storageKeyForUser(userId));
    return;
  }
  localStorage.setItem(storageKeyForUser(userId), JSON.stringify(cycle));
}
