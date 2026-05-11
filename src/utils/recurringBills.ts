import {
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  parse,
  parseISO,
  setDate,
  startOfDay,
} from "date-fns";
import type { BillFrequency, RecurringBill } from "@/types/finance";

export const BILL_FREQUENCY_OPTIONS: Array<{ value: BillFrequency; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "yearly", label: "Yearly" },
];

export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Interpret yyyy-MM-dd as a calendar day in the local timezone (avoids UTC midnight shifting the day). */
export function parseBillDueDate(dateIso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return parse(dateIso, "yyyy-MM-dd", new Date());
  }
  return parseISO(dateIso);
}

/** Normalize Supabase `date` / ISO strings to `yyyy-MM-dd` for stable local calendar math. */
export function formatSupabaseDateCellToIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, "yyyy-MM-dd");
  }
  return null;
}

/** Use stored `next_due_date` when valid; otherwise derive the next monthly due from `dueDay`. */
export function normalizeStoredBillNextDueDate(
  nextRaw: unknown,
  dueDay: number,
  fromDate: Date = new Date(),
): string {
  const iso = formatSupabaseDateCellToIso(nextRaw);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = parseBillDueDate(iso);
    if (!Number.isNaN(d.getTime())) return iso;
  }
  return nextMonthlyDueOnOrAfterFromDueDay(dueDay, fromDate);
}

/** Next monthly occurrence on `dueDay` that is on or after `fromDate` (local calendar). */
export function nextMonthlyDueOnOrAfterFromDueDay(dueDay: number, fromDate: Date = new Date()): string {
  const day = Math.min(31, Math.max(1, Math.floor(dueDay)));
  const today = startOfDay(fromDate);
  const thisMonthCap = Math.min(day, getDaysInMonth(today));
  let cursor = startOfDay(setDate(today, thisMonthCap));
  if (cursor < today) {
    const nextMonthStart = addMonths(startOfDay(setDate(today, 1)), 1);
    const nextCap = Math.min(day, getDaysInMonth(nextMonthStart));
    cursor = startOfDay(setDate(nextMonthStart, nextCap));
  }
  return format(cursor, "yyyy-MM-dd");
}

export function getNextDateForFrequency(dateIso: string, frequency: BillFrequency): string {
  const date = parseBillDueDate(dateIso);
  switch (frequency) {
    case "weekly":
      return toIsoDate(addWeeks(date, 1));
    case "biweekly":
      return toIsoDate(addWeeks(date, 2));
    case "yearly":
      return toIsoDate(addYears(date, 1));
    case "monthly":
    default:
      return toIsoDate(addMonths(date, 1));
  }
}

export function getDaysUntil(dateIso: string, fromDate = new Date()): number {
  return differenceInCalendarDays(startOfDay(parseBillDueDate(dateIso)), startOfDay(fromDate));
}

/**
 * Unpaid recurring bills (`status === "upcoming"`), optionally capped by a calendar end date.
 * Includes overdue rows (due date before today) so they stay visible until marked paid or skipped.
 */
export function getUpcomingBills(bills: RecurringBill[], rangeEndIso?: string): RecurringBill[] {
  const rangeEnd = rangeEndIso ? startOfDay(parseBillDueDate(rangeEndIso)) : null;

  return bills
    .filter((bill) => {
      if (bill.status !== "upcoming") return false;
      if (!bill.nextDueDate?.trim()) return false;
      const dueParsed = parseBillDueDate(bill.nextDueDate);
      if (Number.isNaN(dueParsed.getTime())) return false;
      const due = startOfDay(dueParsed);
      if (rangeEnd && due > rangeEnd) return false;
      return true;
    })
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
}
