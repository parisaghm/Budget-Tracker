import { formatMoney } from "@/utils/money";
import type { MoneyFlowModel } from "@/utils/cycleReviewModel";
import {
  MoneyFlowSegmentBar,
  SEGMENT_COLORS,
} from "@/components/cycle/MoneyFlowSegmentBar";

export function MoneyFlowCard({
  model,
  currency,
}: {
  model: MoneyFlowModel;
  currency: string;
}) {
  if (model.emptyReason) {
    return (
      <section className="card-dashboard rounded-[1.5rem] border border-[#E8DFCC] p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Where the money flowed
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">{model.emptyReason}</p>
      </section>
    );
  }

  const income = formatMoney(model.incomeReceivedCents, currency);

  return (
    <section className="card-dashboard space-y-5 rounded-[1.5rem] border border-[#E8DFCC] p-5 sm:p-6">
      <header>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Where the money flowed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Income received <span className="font-medium text-foreground">{income}</span> — here’s
          where all of it went.
        </p>
      </header>

      <MoneyFlowSegmentBar segments={model.segments} />

      <div className="space-y-4">
        <FlowGroup title="Spent" total={formatMoney(model.spentTotalCents, currency)}>
          {model.spentRows.map((row) => (
            <FlowRow
              key={row.id}
              label={row.label}
              color={SEGMENT_COLORS[row.id]}
              pct={row.percentOfIncomeDisplay}
              amount={formatMoney(row.amountCents, currency)}
            />
          ))}
        </FlowGroup>

        {model.savingsRow ? (
          <FlowGroup
            title="Saved to goals"
            total={formatMoney(model.savingsRow.amountCents, currency)}
          >
            <FlowRow
              label={model.savingsRow.label}
              color={SEGMENT_COLORS.savings}
              statusNote={model.savingsRow.statusNote}
              amount={formatMoney(model.savingsRow.amountCents, currency)}
            />
          </FlowGroup>
        ) : null}

        {model.leftOverRow ? (
          <FlowGroup
            title="Stayed in your account"
            total={formatMoney(model.leftOverRow.amountCents, currency)}
          >
            <FlowRow
              label={model.leftOverRow.label}
              color={SEGMENT_COLORS.left_over}
              statusNote={model.leftOverRow.hint}
              amount={formatMoney(model.leftOverRow.amountCents, currency)}
            />
          </FlowGroup>
        ) : null}
      </div>

      {model.perTenBreakdown ? (
        <p className="rounded-2xl bg-[#F6F0E4]/80 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          Of every {formatMoney(1000, currency)} you earned this cycle:{" "}
          <span className="font-medium text-foreground">
            {formatMoney(model.perTenBreakdown.spentPerTenCents, currency)}
          </span>{" "}
          was spent,{" "}
          <span className="font-medium text-foreground">
            {formatMoney(model.perTenBreakdown.savedPerTenCents, currency)}
          </span>{" "}
          went to savings goals, and{" "}
          <span className="font-medium text-foreground">
            {formatMoney(model.perTenBreakdown.leftPerTenCents, currency)}
          </span>{" "}
          stayed in your account.
        </p>
      ) : null}
    </section>
  );
}

function FlowGroup({
  title,
  total,
  children,
}: {
  title: string;
  total: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="label-caps text-muted-foreground">{title}</p>
        <p className="money-display text-sm font-semibold tabular-nums">{total}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FlowRow({
  label,
  color,
  pct,
  statusNote,
  amount,
}: {
  label: string;
  color: string;
  pct?: number | null;
  statusNote?: string;
  amount: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="truncate text-sm text-foreground">{label}</span>
        {statusNote ? (
          <span className="truncate text-xs text-muted-foreground">{statusNote}</span>
        ) : pct != null ? (
          <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
        ) : null}
      </div>
      <span className="money-display shrink-0 text-sm font-medium tabular-nums">
        {amount}
      </span>
    </div>
  );
}
