import { useState } from "react";
import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";

export interface BudgetSidebarSummaryTabsProps {
  incomePlannedCents: number;
  expensesPlannedCents: number;
  contributionsPlannedCents: number;
  leftToBudgetCents: number;
  incomeActualCents: number;
  expensesActualCents: number;
  incomeRowCount: number;
  expenseRowCount: number;
  currency?: string;
  className?: string;
}

type SummaryTab = "summary" | "income" | "expenses";

const TABS: { id: SummaryTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "income", label: "Income" },
  { id: "expenses", label: "Expenses" },
];

export function BudgetSidebarSummaryTabs({
  incomePlannedCents,
  expensesPlannedCents,
  contributionsPlannedCents,
  leftToBudgetCents,
  incomeActualCents,
  expensesActualCents,
  incomeRowCount,
  expenseRowCount,
  currency = "EUR",
  className,
}: BudgetSidebarSummaryTabsProps) {
  const [tab, setTab] = useState<SummaryTab>("summary");

  return (
    <section
      className={cn(
        "card-dashboard rounded-[1.5rem] border border-border/70 p-4 sm:p-5 lg:rounded-[1.75rem]",
        className,
      )}
      aria-label="Budget summary"
    >
      <div
        className="flex gap-1 rounded-full bg-secondary/80 p-1"
        role="tablist"
        aria-label="Summary views"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`budget-summary-tab-${item.id}`}
              className={cn(
                "flex-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-popover text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        aria-labelledby={`budget-summary-tab-${tab}`}
        className="mt-4 space-y-2.5 text-sm"
      >
        {tab === "summary" ? (
          <>
            <SummaryLine
              label="Income planned"
              amountCents={incomePlannedCents}
              currency={currency}
              kind="income"
            />
            <SummaryLine
              label="Expenses planned"
              amountCents={expensesPlannedCents}
              currency={currency}
              kind="deduction"
            />
            <SummaryLine
              label="Contributions planned"
              amountCents={contributionsPlannedCents}
              currency={currency}
              kind="deduction"
            />
            <div className="border-t border-border/70 pt-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-foreground">Left to Budget</span>
                <span
                  className={cn(
                    "money-display font-semibold tabular-nums",
                    leftToBudgetCents < 0
                      ? "text-destructive"
                      : leftToBudgetCents > 0
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {formatMoney(leftToBudgetCents, currency)}
                </span>
              </div>
            </div>
          </>
        ) : null}

        {tab === "income" ? (
          <>
            <SummaryLine
              label="Income sources"
              amountCents={incomeRowCount}
              currency={currency}
              kind="count"
            />
            <SummaryLine
              label="Planned"
              amountCents={incomePlannedCents}
              currency={currency}
              kind="income"
            />
            <SummaryLine
              label="Received"
              amountCents={incomeActualCents}
              currency={currency}
              kind="income"
            />
            <div className="border-t border-border/70 pt-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-foreground">Remaining</span>
                <span className="money-display font-semibold tabular-nums text-success">
                  {formatMoney(incomePlannedCents - incomeActualCents, currency)}
                </span>
              </div>
            </div>
          </>
        ) : null}

        {tab === "expenses" ? (
          <>
            <SummaryLine
              label="Expense lines"
              amountCents={expenseRowCount}
              currency={currency}
              kind="count"
            />
            <SummaryLine
              label="Planned"
              amountCents={expensesPlannedCents}
              currency={currency}
              kind="income"
            />
            <SummaryLine
              label="Actual"
              amountCents={expensesActualCents}
              currency={currency}
              kind="deduction"
            />
            <div className="border-t border-border/70 pt-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-foreground">Remaining</span>
                <span
                  className={cn(
                    "money-display font-semibold tabular-nums",
                    expensesPlannedCents - expensesActualCents < 0
                      ? "text-destructive"
                      : "text-success",
                  )}
                >
                  {formatMoney(expensesPlannedCents - expensesActualCents, currency)}
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function SummaryLine({
  label,
  amountCents,
  currency,
  kind,
}: {
  label: string;
  amountCents: number;
  currency: string;
  kind: "income" | "deduction" | "count";
}) {
  if (kind === "count") {
    return (
      <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{amountCents}</span>
      </div>
    );
  }
  const prefix = kind === "deduction" ? "− " : "";
  return (
    <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="money-display tabular-nums text-foreground/90">
        {prefix}
        {formatMoney(amountCents, currency)}
      </span>
    </div>
  );
}
