import { formatMoney } from "@/utils/money";
import { cn } from "@/lib/utils";

export interface BudgetSidebarLeftToBudgetCardProps {
  leftToBudgetCents: number;
  currency?: string;
  onAssignMoney?: () => void;
  onAdjustIncome?: () => void;
  className?: string;
}

export function BudgetSidebarLeftToBudgetCard({
  leftToBudgetCents,
  currency = "EUR",
  onAssignMoney,
  onAdjustIncome,
  className,
}: BudgetSidebarLeftToBudgetCardProps) {
  const isOverAssigned = leftToBudgetCents < 0;
  const displayCents = leftToBudgetCents;
  const amountLabel = formatMoney(Math.abs(displayCents), currency);

  return (
    <section
      className={cn(
        "budget-ltb-card relative overflow-hidden rounded-[1.5rem] p-5 text-primary-foreground lg:rounded-[1.75rem] lg:p-6",
        className,
      )}
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 100% 0%, hsl(270 32% 52% / 0.45), transparent 55%), linear-gradient(155deg, hsl(var(--primary)) 0%, hsl(var(--primary-deep)) 100%)",
      }}
      aria-labelledby="left-to-budget-heading"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 right-6 h-36 w-36 rounded-full border border-white/10"
        aria-hidden
      />

      <p className="label-caps text-[10px] tracking-[0.1em] text-white/70">Budget planning</p>
      <h2
        id="left-to-budget-heading"
        className="mt-2 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl"
      >
        Left to Budget
      </h2>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight text-white sm:text-4xl">
        {isOverAssigned ? `−${amountLabel}` : amountLabel}
      </p>
      <p className="mt-2 max-w-[18rem] text-sm leading-snug text-white/75">
        {isOverAssigned
          ? "Assigned amounts exceed planned income for this cycle."
          : "Money not yet assigned to categories."}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-full bg-black/20 p-1.5 pl-3 backdrop-blur-sm">
        <p className="min-w-0 flex-1 truncate text-xs text-white/85 sm:text-sm">
          {isOverAssigned
            ? `${amountLabel} is over-assigned`
            : displayCents > 0
              ? `${amountLabel} is still unassigned`
              : "Fully assigned"}
        </p>
        {onAssignMoney && displayCents > 0 ? (
          <button
            type="button"
            onClick={onAssignMoney}
            className="shrink-0 rounded-full bg-primary-foreground px-3.5 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-90"
          >
            Assign money
          </button>
        ) : null}
        {onAdjustIncome && (displayCents <= 0 || isOverAssigned) ? (
          <button
            type="button"
            onClick={onAdjustIncome}
            className="shrink-0 rounded-full bg-primary-foreground px-3.5 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-90"
          >
            Adjust income
          </button>
        ) : null}
      </div>
    </section>
  );
}
