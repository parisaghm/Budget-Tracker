import { supabase } from "@/lib/supabase/client";
import { isIncomeCyclePreset, type IncomeCycle } from "@/types/incomeCycle";
import { isIncomeCycleConfigured } from "@/utils/incomeCycle";
import { isPresetCurrency, normalizeCurrencyCode } from "@/utils/money";

export type MonthSelectionSource =
  | "income_cycle_active"
  | "supabase_selected_month"
  | "localStorage_selected_month"
  | "default_current_month"
  | "demo"
  | "manual_navigation";

export type SettingsPersistenceSource = "supabase" | "localStorage" | "none";

export interface UserFinanceSettings {
  incomeCycle: IncomeCycle | null;
  selectedMonth: string | null;
  /** App-wide display preference; null when row/column missing. */
  displayCurrency: string | null;
  source: SettingsPersistenceSource;
}

const DISPLAY_CURRENCY_STORAGE_PREFIX = "bt_display_currency_v1:";

export function displayCurrencyStorageKey(userId: string): string {
  return `${DISPLAY_CURRENCY_STORAGE_PREFIX}${userId}`;
}

export function readDisplayCurrencyFromLocalStorage(userId: string): string | null {
  try {
    const raw = localStorage.getItem(displayCurrencyStorageKey(userId));
    if (!raw) return null;
    const code = normalizeCurrencyCode(raw);
    return isPresetCurrency(code) ? code : null;
  } catch {
    return null;
  }
}

export function writeDisplayCurrencyToLocalStorage(userId: string, code: string): void {
  try {
    const normalized = normalizeCurrencyCode(code);
    if (!isPresetCurrency(normalized)) return;
    localStorage.setItem(displayCurrencyStorageKey(userId), normalized);
  } catch {
    // ignore quota / private mode
  }
}

function parseIncomeCycle(raw: unknown): IncomeCycle | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as { preset?: unknown; day?: unknown };
  // Deprecated presets (weekly / biweekly / last working day) resolve to null
  // so Settings stays unselected; stored JSON is left untouched until the user saves.
  if (!isIncomeCyclePreset(parsed.preset)) return null;
  const cycle: IncomeCycle = {
    preset: parsed.preset,
    day: typeof parsed.day === "number" ? parsed.day : undefined,
  };
  return isIncomeCycleConfigured(cycle) ? cycle : null;
}

function isUserSettingsSchemaError(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("user_settings") &&
    (normalized.includes("does not exist") ||
      normalized.includes("relation") ||
      normalized.includes("schema cache") ||
      normalized.includes("display_currency") ||
      normalized.includes("column"))
  );
}

function parseDisplayCurrency(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const code = normalizeCurrencyCode(raw);
  return isPresetCurrency(code) ? code : null;
}

export async function fetchUserSettings(userId: string): Promise<UserFinanceSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("income_cycle, selected_month, display_currency")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Column may not exist until migration is applied — retry without it.
    if (isUserSettingsSchemaError(error.message) || error.message.toLowerCase().includes("display_currency")) {
      const fallback = await supabase
        .from("user_settings")
        .select("income_cycle, selected_month")
        .eq("user_id", userId)
        .maybeSingle();
      if (fallback.error) {
        if (import.meta.env.DEV && !isUserSettingsSchemaError(fallback.error.message)) {
          console.warn("[user_settings] fetch failed", fallback.error.message);
        }
        return null;
      }
      if (!fallback.data) {
        return { incomeCycle: null, selectedMonth: null, displayCurrency: null, source: "none" };
      }
      const selectedMonth =
        typeof fallback.data.selected_month === "string" &&
        /^\d{4}-\d{2}$/.test(fallback.data.selected_month)
          ? fallback.data.selected_month
          : null;
      return {
        incomeCycle: parseIncomeCycle(fallback.data.income_cycle),
        selectedMonth,
        displayCurrency: null,
        source: "supabase",
      };
    }
    if (import.meta.env.DEV) {
      console.warn("[user_settings] fetch failed", error.message);
    }
    return null;
  }

  if (!data) {
    return { incomeCycle: null, selectedMonth: null, displayCurrency: null, source: "none" };
  }

  const selectedMonth =
    typeof data.selected_month === "string" && /^\d{4}-\d{2}$/.test(data.selected_month)
      ? data.selected_month
      : null;

  const row = data as { income_cycle?: unknown; selected_month?: unknown; display_currency?: unknown };

  return {
    incomeCycle: parseIncomeCycle(row.income_cycle),
    selectedMonth,
    displayCurrency: parseDisplayCurrency(row.display_currency),
    source: "supabase",
  };
}

export async function upsertUserIncomeCycle(
  userId: string,
  cycle: IncomeCycle | null,
): Promise<boolean> {
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      income_cycle: cycle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (import.meta.env.DEV && !isUserSettingsSchemaError(error.message)) {
      console.warn("[user_settings] upsert income cycle failed", error.message);
    }
    return false;
  }
  return true;
}

export async function upsertUserSelectedMonth(userId: string, month: string): Promise<boolean> {
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      selected_month: month,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (import.meta.env.DEV && !isUserSettingsSchemaError(error.message)) {
      console.warn("[user_settings] upsert selected month failed", error.message);
    }
    return false;
  }
  return true;
}

/** Persist app-wide display currency only. Does not touch finance tables. */
export async function upsertUserDisplayCurrency(
  userId: string,
  currency: string,
): Promise<{ ok: boolean; currency: string | null; errorMessage?: string }> {
  const normalized = normalizeCurrencyCode(currency);
  if (!isPresetCurrency(normalized)) {
    return {
      ok: false,
      currency: null,
      errorMessage: "Unsupported currency code",
    };
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      display_currency: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[user_settings] upsert display_currency failed", error.message);
    }
    return { ok: false, currency: null, errorMessage: error.message };
  }

  writeDisplayCurrencyToLocalStorage(userId, normalized);
  return { ok: true, currency: normalized };
}

export function getSupabaseProjectHost(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || typeof url !== "string") return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
