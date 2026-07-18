import { supabase } from "@/lib/supabase/client";
import { isIncomeCyclePreset, type IncomeCycle } from "@/types/incomeCycle";
import { isIncomeCycleConfigured } from "@/utils/incomeCycle";

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
  source: SettingsPersistenceSource;
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
      normalized.includes("schema cache"))
  );
}

export async function fetchUserSettings(userId: string): Promise<UserFinanceSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("income_cycle, selected_month")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV && !isUserSettingsSchemaError(error.message)) {
      console.warn("[user_settings] fetch failed", error.message);
    }
    return null;
  }

  if (!data) {
    return { incomeCycle: null, selectedMonth: null, source: "none" };
  }

  const selectedMonth =
    typeof data.selected_month === "string" && /^\d{4}-\d{2}$/.test(data.selected_month)
      ? data.selected_month
      : null;

  return {
    incomeCycle: parseIncomeCycle(data.income_cycle),
    selectedMonth,
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

export function getSupabaseProjectHost(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || typeof url !== "string") return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
