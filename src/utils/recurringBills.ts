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
  seriesStartIso?: string | null,
): string {
  const iso = formatSupabaseDateCellToIso(nextRaw);
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = parseBillDueDate(iso);
    if (!Number.isNaN(d.getTime())) return iso;
  }
  let anchor = startOfDay(fromDate);
  const seriesStart = formatSupabaseDateCellToIso(seriesStartIso);
  if (seriesStart) {
    const seriesStartDate = startOfDay(parseBillDueDate(seriesStart));
    if (!Number.isNaN(seriesStartDate.getTime()) && seriesStartDate > anchor) {
      anchor = seriesStartDate;
    }
  }
  return nextMonthlyDueOnOrAfterFromDueDay(dueDay, anchor);
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
export function isBillSeriesActive(bill: RecurringBill): boolean {
  if (bill.paymentCount == null) return true;
  return (bill.paymentsCompleted ?? 0) < bill.paymentCount;
}

export function getBillPaymentsRemaining(bill: RecurringBill): number | null {
  if (bill.paymentCount == null) return null;
  return Math.max(0, bill.paymentCount - (bill.paymentsCompleted ?? 0));
}

/** Last due date in a fixed payment series. */
export function getBillSeriesEndDate(
  seriesStartIso: string,
  frequency: BillFrequency,
  paymentCount: number,
): string {
  if (paymentCount <= 1) return seriesStartIso;
  let cursor = seriesStartIso;
  for (let i = 1; i < paymentCount; i++) {
    cursor = getNextDateForFrequency(cursor, frequency);
  }
  return cursor;
}

export function formatBillSeriesSummary(bill: RecurringBill): string | null {
  if (!bill.paymentCount) return null;
  const remaining = getBillPaymentsRemaining(bill);
  if (remaining === 0) {
    return `Completed · ${bill.paymentCount} payment${bill.paymentCount === 1 ? "" : "s"}`;
  }
  const endIso = getBillSeriesEndDate(
    bill.seriesStartDate ?? bill.nextDueDate,
    bill.frequency,
    bill.paymentCount,
  );
  const endLabel = format(parseBillDueDate(endIso), "MMM d, yyyy");
  return `${remaining} of ${bill.paymentCount} left · ends ${endLabel}`;
}

export function formatBillDueDateLabel(dateIso: string, pattern = "MMM d"): string {
  return format(parseBillDueDate(dateIso), pattern);
}

/**
 * Unpaid recurring bills for a budget window.
 * - `rangeEndIso`: exclusive end (e.g. first day of next month / next salary).
 * - `rangeStartIso`: inclusive start of selected month; overdue bills before this still show.
 */
export function getUpcomingBills(
  bills: RecurringBill[],
  rangeEndIso?: string,
  rangeStartIso?: string,
  referenceDate = new Date(),
): RecurringBill[] {
  const rangeEnd = rangeEndIso ? startOfDay(parseBillDueDate(rangeEndIso)) : null;
  const rangeStart = rangeStartIso ? startOfDay(parseBillDueDate(rangeStartIso)) : null;
  const today = startOfDay(referenceDate);

  return bills
    .filter((bill) => {
      if (bill.status !== "upcoming") return false;
      if (!isBillSeriesActive(bill)) return false;
      if (!bill.nextDueDate?.trim()) return false;
      const dueParsed = parseBillDueDate(bill.nextDueDate);
      if (Number.isNaN(dueParsed.getTime())) return false;
      const due = startOfDay(dueParsed);

      const seriesStartIso = bill.seriesStartDate ?? formatSupabaseDateCellToIso(bill.nextDueDate);
      if (seriesStartIso) {
        const seriesStart = startOfDay(parseBillDueDate(seriesStartIso));
        if (!Number.isNaN(seriesStart.getTime()) && due < seriesStart) return false;
      }

      if (rangeEnd && due >= rangeEnd) return false;
      if (rangeStart && due < rangeStart && due >= today) return false;
      return true;
    })
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
}
