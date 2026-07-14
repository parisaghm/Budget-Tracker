export type CategoryBudgetStatus = "under" | "close" | "over";

/** Spent ≥ this fraction of limit counts as near limit (matches filter + attention). */
export const CLOSE_TO_LIMIT_THRESHOLD = 0.8;

export type CategoryManagementStatus = "over" | "near" | "healthy" | "no_limit";

export function resolveCategoryBudgetStatus(
  spentCents: number,
  limitCents: number | undefined,
): CategoryBudgetStatus | null {
  if (limitCents == null || limitCents <= 0) return null;
  if (spentCents >= limitCents) return "over";
  if (spentCents >= limitCents * CLOSE_TO_LIMIT_THRESHOLD) return "close";
  return "under";
}

export function resolveCategoryManagementStatus(
  spentCents: number,
  limitCents: number,
): CategoryManagementStatus {
  if (limitCents <= 0) return "no_limit";
  if (spentCents >= limitCents) return "over";
  if (spentCents >= limitCents * CLOSE_TO_LIMIT_THRESHOLD) return "near";
  return "healthy";
}

export function categoryStatusBarColor(
  status: CategoryBudgetStatus | null,
  fallbackBar: string,
): string {
  if (status === "over") return "hsl(var(--destructive))";
  if (status === "close") return "hsl(var(--warning))";
  if (status === "under") return "hsl(var(--success))";
  return fallbackBar;
}

export function managementStatusBarColor(status: CategoryManagementStatus): string {
  if (status === "over") return "hsl(var(--destructive))";
  if (status === "near") return "hsl(var(--warning))";
  if (status === "healthy") return "hsl(var(--success))";
  return "hsl(var(--muted-foreground) / 0.35)";
}

export function categoryStatusLabel(
  spentCents: number,
  limitCents: number | undefined,
  currency: string,
  formatMoney: (cents: number, currency: string) => string,
): string {
  if (limitCents == null || limitCents <= 0) {
    return spentCents > 0
      ? `${formatMoney(spentCents, currency)} spent · set a limit`
      : "No limit set";
  }

  const remaining = limitCents - spentCents;
  const status = resolveCategoryBudgetStatus(spentCents, limitCents);

  if (status === "over") {
    return `${formatMoney(spentCents - limitCents, currency)} over`;
  }

  if (status === "close") {
    return `${formatMoney(remaining, currency)} left`;
  }

  return `${formatMoney(remaining, currency)} left`;
}

export function managementStatusLabel(status: CategoryManagementStatus): string {
  if (status === "over") return "Over budget";
  if (status === "near") return "Near limit";
  if (status === "healthy") return "On track";
  return "No limit";
}
