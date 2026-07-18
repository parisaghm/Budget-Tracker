export type BudgetCycleStatus = "active" | "closed" | "scheduled";

export interface BudgetCycle {
  id: string;
  userId: string;
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string; // YYYY-MM-DD exclusive
  status: BudgetCycleStatus;
  scheduleType: string;
  createdAt: string;
}

export interface IncomeEntry {
  id: string;
  userId: string;
  cycleId: string;
  amountCents: number;
  receivedDate: string | null;
  source: string | null;
  note: string | null;
  dateIsEstimated: boolean;
  legacyBudgetMonthId: string | null;
  createdAt: string;
}
