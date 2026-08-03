import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import { formatMoney } from "@/utils/money";
import type { ExpensesCategoryBreakdownItem } from "@/utils/expensesPageModel";
import { cn } from "@/lib/utils";

type DonutSlice = {
  key: string;
  name: string;
  value: number;
  color: string;
};

interface SpendingCategoryDonutProps {
  breakdown: ExpensesCategoryBreakdownItem[];
  totalCycleSpendingCents: number;
  plannedExpenseTotalCents: number;
  hasPlannedExpenses: boolean;
  selectedCategory: string | "all";
  selectedBreakdown: ExpensesCategoryBreakdownItem | null;
  currency: string;
  onSelectCategory: (category: string | "all") => void;
  className?: string;
}

function ActiveShape(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}) {
  const { cx = 0, cy = 0, innerRadius = 0, outerRadius = 0, startAngle = 0, endAngle = 0, fill } =
    props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 4}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="#FFFDF8"
      strokeWidth={2}
    />
  );
}

export function SpendingCategoryDonut({
  breakdown,
  totalCycleSpendingCents,
  plannedExpenseTotalCents,
  hasPlannedExpenses,
  selectedCategory,
  selectedBreakdown,
  currency,
  onSelectCategory,
  className,
}: SpendingCategoryDonutProps) {
  const data: DonutSlice[] =
    breakdown.length > 0
      ? breakdown.map((row) => ({
          key: row.categoryValue,
          name: row.categoryLabel,
          value: row.spentCents,
          color: row.color,
        }))
      : [{ key: "empty", name: "No spending", value: 1, color: "hsl(var(--muted))" }];

  const activeIndex =
    selectedCategory === "all"
      ? -1
      : data.findIndex((d) => d.key === selectedCategory);

  const centreLabel =
    selectedBreakdown != null ? selectedBreakdown.categoryLabel.toUpperCase() : "THIS CYCLE";
  const centreAmount =
    selectedBreakdown != null ? selectedBreakdown.spentCents : totalCycleSpendingCents;
  const supporting =
    selectedBreakdown != null
      ? `${selectedBreakdown.percentOfTotal}% of cycle spending`
      : hasPlannedExpenses
        ? `of ${formatMoney(plannedExpenseTotalCents, currency)} planned`
        : "No expense plan set";

  const summaryText =
    breakdown.length === 0
      ? "No spending recorded this cycle."
      : `Spending this cycle: ${formatMoney(totalCycleSpendingCents, currency)} across ${breakdown.length} categories. ${
          hasPlannedExpenses
            ? `Planned expense budget: ${formatMoney(plannedExpenseTotalCents, currency)}.`
            : "No expense plan set."
        }`;

  const isInteractive = breakdown.length > 0;

  return (
    <div className={cn("relative mx-auto w-full max-w-[260px]", className)}>
      <p className="sr-only">{summaryText}</p>
      <div className="relative aspect-square w-full" role="img" aria-label={summaryText}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={breakdown.length > 1 ? 1.5 : 0}
              stroke="#FFFDF8"
              strokeWidth={2}
              activeIndex={activeIndex >= 0 ? activeIndex : undefined}
              activeShape={activeIndex >= 0 ? ActiveShape : undefined}
              onClick={(_, index) => {
                if (!isInteractive) return;
                const slice = data[index];
                if (!slice || slice.key === "empty") return;
                onSelectCategory(slice.key === selectedCategory ? "all" : slice.key);
              }}
              style={{ cursor: isInteractive ? "pointer" : "default", outline: "none" }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  opacity={
                    selectedCategory === "all" || entry.key === selectedCategory ? 1 : 0.35
                  }
                  tabIndex={isInteractive && entry.key !== "empty" ? 0 : -1}
                  role={isInteractive && entry.key !== "empty" ? "button" : undefined}
                  aria-label={
                    entry.key !== "empty"
                      ? `${entry.name}, ${formatMoney(entry.value, currency)}`
                      : undefined
                  }
                  onKeyDown={(event) => {
                    if (!isInteractive || entry.key === "empty") return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectCategory(entry.key === selectedCategory ? "all" : entry.key);
                    }
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="label-caps text-[10px] tracking-[0.12em] text-muted-foreground">
            {centreLabel}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[1.65rem]">
            {formatMoney(centreAmount, currency)}
          </p>
          <p
            className="mt-1 max-w-[9.5rem] text-[11px] leading-snug text-muted-foreground"
            title={
              selectedBreakdown == null
                ? "Planned is the total amount assigned to expense categories for this cycle."
                : undefined
            }
          >
            {supporting}
          </p>
        </div>
      </div>

      {selectedCategory !== "all" ? (
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          className="mx-auto mt-1 block text-center text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Showing {selectedBreakdown?.categoryLabel ?? "category"} · clear filter
        </button>
      ) : (
        <p className="mt-1 text-center text-xs text-muted-foreground">Showing all categories</p>
      )}
    </div>
  );
}
