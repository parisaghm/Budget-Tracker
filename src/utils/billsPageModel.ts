import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import type { BillFrequency, Expense, RecurringBill } from "@/types/finance";
import { BILL_FREQUENCY_OPTIONS, getDaysUntil, parseBillDueDate } from "@/utils/recurringBills";

/**
 * Prefix used by `markRecurringBillPaid` when it creates the durable expense for a
 * paid bill occurrence. There is no per-occurrence payment ledger, so "recently paid"
 * and the calendar "paid" markers are reconstructed from expenses that match this prefix.
 */
export const BILL_EXPENSE_NOTE_PREFIX = "Paid recurring bill:";

const FREQUENCY_LABEL: Record<BillFrequency, string> = Object.fromEntries(
  BILL_FREQUENCY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<BillFrequency, string>;

export type BillTiming = "overdue" | "today" | "upcoming";

export interface RecentlyPaidItem {
  /** Underlying expense id. */
  id: string;
  name: string;
  amountCents: number;
  /** Payment date shown to the user (expense.date == occurrence due date). */
  paidDate: string;
  category: string;
  /** Enriched from a matching recurring bill by name when available. */
  frequency: BillFrequency | null;
  isOneTime: boolean;
}

export interface CalendarDayActivity {
  date: string;
  upcomingCount: number;
  dueTodayCount: number;
  overdueCount: number;
  paidCount: number;
}

export interface BillsPageModel {
  dueBeforeNextIncomeCents: number;
  /** Upcoming unpaid bills sorted overdue -> due today -> ascending due date. */
  upcomingBills: RecurringBill[];
  overdueBills: RecurringBill[];
  dueTodayBills: RecurringBill[];
  thisWeekBills: RecurringBill[];
  recurringBills: RecurringBill[];
  oneTimeBills: RecurringBill[];
  recentlyPaidBills: RecentlyPaidItem[];
  calendarEvents: Record<string, CalendarDayActivity>;
}

export interface BuildBillsPageModelInput {
  /** Result of `getUpcomingBills` (unpaid, within the current cycle window). */
  upcomingBills: RecurringBill[];
  /** All recurring bills (used to enrich recently-paid rows with recurrence/category). */
  allRecurringBills: RecurringBill[];
  /** All expenses (used to reconstruct paid history). */
  allExpenses: Expense[];
  today?: Date;
  /** How far back "recently paid" looks, in days. */
  recentlyPaidWindowDays?: number;
}

export function isBillOneTime(bill: Pick<RecurringBill, "paymentCount">): boolean {
  return bill.paymentCount === 1;
}

export function isBillOngoingRecurring(bill: Pick<RecurringBill, "paymentCount">): boolean {
  return bill.paymentCount == null;
}

/** Timing bucket for a bill's `nextDueDate` relative to `today`. */
export function getBillTiming(dueDateIso: string, today = new Date()): BillTiming {
  const days = getDaysUntil(dueDateIso, today);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "upcoming";
}

/** Human-friendly relative label, e.g. "in 10 days", "today", "2 days overdue". */
export function formatBillRelativeTiming(dueDateIso: string, today = new Date()): string {
  const days = getDaysUntil(dueDateIso, today);
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "today";
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Recurrence label for a bill; one-time series read as "One-time". */
export function getBillRecurrenceLabel(bill: Pick<RecurringBill, "frequency" | "paymentCount">): string {
  if (isBillOneTime(bill)) return "One-time";
  return FREQUENCY_LABEL[bill.frequency] ?? "Recurring";
}

/** Frequency label for a recently-paid row. */
function formatRecentlyPaidRecurrence(item: RecentlyPaidItem): string {
  if (item.isOneTime) return "One-time";
  if (item.frequency) return FREQUENCY_LABEL[item.frequency] ?? "Recurring";
  return "Recurring";
}

export function getRecentlyPaidRecurrenceLabel(item: RecentlyPaidItem): string {
  return formatRecentlyPaidRecurrence(item);
}

/** Extract the bill name from a bill-generated expense note. */
export function parseBillNameFromExpenseNote(note: string): string {
  const withoutPrefix = note.slice(BILL_EXPENSE_NOTE_PREFIX.length).trim();
  // Notes look like: "Paid recurring bill: {name} — {optional bill note}"
  const separatorIndex = withoutPrefix.indexOf(" — ");
  const name = separatorIndex >= 0 ? withoutPrefix.slice(0, separatorIndex) : withoutPrefix;
  return name.trim();
}

function isBillExpense(expense: Expense): boolean {
  return typeof expense.note === "string" && expense.note.startsWith(BILL_EXPENSE_NOTE_PREFIX);
}

function timingRank(timing: BillTiming): number {
  if (timing === "overdue") return 0;
  if (timing === "today") return 1;
  return 2;
}

function sortUpcoming(bills: RecurringBill[], today: Date): RecurringBill[] {
  return [...bills].sort((a, b) => {
    const rankDiff = timingRank(getBillTiming(a.nextDueDate, today)) - timingRank(getBillTiming(b.nextDueDate, today));
    if (rankDiff !== 0) return rankDiff;
    return a.nextDueDate.localeCompare(b.nextDueDate);
  });
}

export function buildBillsPageModel({
  upcomingBills,
  allRecurringBills,
  allExpenses,
  today = new Date(),
  recentlyPaidWindowDays = 30,
}: BuildBillsPageModelInput): BillsPageModel {
  const startToday = startOfDay(today);
  const sortedUpcoming = sortUpcoming(upcomingBills, today);

  const dueBeforeNextIncomeCents = sortedUpcoming.reduce((sum, bill) => sum + bill.amountCents, 0);

  const overdueBills: RecurringBill[] = [];
  const dueTodayBills: RecurringBill[] = [];
  const thisWeekBills: RecurringBill[] = [];
  const recurringBills: RecurringBill[] = [];
  const oneTimeBills: RecurringBill[] = [];

  const calendarEvents: Record<string, CalendarDayActivity> = {};
  const ensureDay = (date: string): CalendarDayActivity => {
    if (!calendarEvents[date]) {
      calendarEvents[date] = {
        date,
        upcomingCount: 0,
        dueTodayCount: 0,
        overdueCount: 0,
        paidCount: 0,
      };
    }
    return calendarEvents[date];
  };

  for (const bill of sortedUpcoming) {
    const timing = getBillTiming(bill.nextDueDate, today);
    const days = getDaysUntil(bill.nextDueDate, today);

    if (timing === "overdue") overdueBills.push(bill);
    else if (timing === "today") dueTodayBills.push(bill);
    if (days >= 0 && days <= 7) thisWeekBills.push(bill);
    if (isBillOneTime(bill)) oneTimeBills.push(bill);
    else if (isBillOngoingRecurring(bill)) recurringBills.push(bill);

    const dayKey = format(startOfDay(parseBillDueDate(bill.nextDueDate)), "yyyy-MM-dd");
    const activity = ensureDay(dayKey);
    if (timing === "overdue") activity.overdueCount += 1;
    else if (timing === "today") activity.dueTodayCount += 1;
    else activity.upcomingCount += 1;
  }

  const billByNormalizedName = new Map<string, RecurringBill>();
  for (const bill of allRecurringBills) {
    const key = bill.name.trim().toLowerCase();
    if (!billByNormalizedName.has(key)) billByNormalizedName.set(key, bill);
  }

  const recentlyPaidBills: RecentlyPaidItem[] = allExpenses
    .filter((expense) => {
      if (!isBillExpense(expense)) return false;
      const paid = startOfDay(parseBillDueDate(expense.date.slice(0, 10)));
      const diff = differenceInCalendarDays(startToday, paid);
      return diff >= 0 && diff <= recentlyPaidWindowDays;
    })
    .map((expense) => {
      const name = parseBillNameFromExpenseNote(expense.note) || "Bill";
      const matched = billByNormalizedName.get(name.toLowerCase());
      const item: RecentlyPaidItem = {
        id: expense.id,
        name,
        amountCents: expense.amountCents,
        paidDate: expense.date.slice(0, 10),
        category: expense.category,
        frequency: matched?.frequency ?? null,
        isOneTime: matched ? isBillOneTime(matched) : false,
      };
      const activity = ensureDay(item.paidDate);
      activity.paidCount += 1;
      return item;
    })
    .sort((a, b) => b.paidDate.localeCompare(a.paidDate));

  return {
    dueBeforeNextIncomeCents,
    upcomingBills: sortedUpcoming,
    overdueBills,
    dueTodayBills,
    thisWeekBills,
    recurringBills,
    oneTimeBills,
    recentlyPaidBills,
    calendarEvents,
  };
}
