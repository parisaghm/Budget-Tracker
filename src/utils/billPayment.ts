import type { RecurringBill } from "@/types/finance";

export const BILL_PAYMENT_DEBUG_PREFIX = "[Bill payment]";

/** True when this bill is currently reserved in the upcoming-bills deduction. */
export function isBillReservedInUpcoming(
  bill: RecurringBill,
  upcomingBills: RecurringBill[],
): boolean {
  return upcomingBills.some((item) => item.id === bill.id);
}

/**
 * Safe-to-spend after marking paid.
 * Reserved bills move from upcoming → spent without changing safe-to-spend.
 */
export function projectSafeToSpendAfterBillPayment(
  safeToSpendCents: number,
  billAmountCents: number,
  wasBillReserved: boolean,
): number {
  if (wasBillReserved) return safeToSpendCents;
  return safeToSpendCents - billAmountCents;
}

/** Cents that must be freed (from savings/goals) before paying an unreserved bill. */
export function billPaymentFundingShortfallCents(
  safeToSpendCents: number,
  billAmountCents: number,
  wasBillReserved: boolean,
): number {
  if (wasBillReserved) return 0;
  return Math.max(0, billAmountCents - safeToSpendCents);
}

export function needsFundingBeforeBillPayment(
  safeToSpendCents: number,
  billAmountCents: number,
  wasBillReserved: boolean,
): boolean {
  return billPaymentFundingShortfallCents(safeToSpendCents, billAmountCents, wasBillReserved) > 0;
}

export function logBillPaymentDebug(payload: {
  billAmountCents: number;
  wasBillReserved: boolean;
  safeToSpendBefore: number;
  safeToSpendAfter: number;
  paid: boolean;
  expensesTotalAfter: number;
  billName?: string;
  billId?: string;
}): void {
  console.debug(BILL_PAYMENT_DEBUG_PREFIX, payload);
}
