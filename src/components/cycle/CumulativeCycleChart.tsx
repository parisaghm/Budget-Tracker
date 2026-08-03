import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { formatMoney } from "@/utils/money";
import type { PaceModel } from "@/utils/cycleReviewModel";

export function CumulativeCycleChart({
  pace,
  currency,
}: {
  pace: PaceModel;
  currency: string;
}) {
  const data = pace.series.points.map((p) => ({
    dateYmd: p.dateYmd,
    dayIndex: p.dayIndex,
    actual: p.cumulativeActualCents,
    projected: p.cumulativeProjectedCents,
    isToday: p.isToday,
    label: format(parseISO(p.dateYmd), "MMM d"),
  }));

  const todayPoint = pace.series.points.find((p) => p.isToday);
  const planCents = pace.hasPlannedExpenses ? pace.plannedExpensesCents : null;
  const projected = pace.projection.projectedSpendCents;

  const summaryParts: string[] = [
    `Spent so far ${formatMoney(pace.actualSpentCents, currency)}.`,
  ];
  if (planCents != null) {
    summaryParts.push(`Plan ${formatMoney(planCents, currency)}.`);
  }
  if (projected != null) {
    summaryParts.push(
      `Projected cycle end ${formatMoney(projected, currency)}${
        pace.projection.kind === "early_estimate" ? " (early estimate)" : ""
      }.`,
    );
  }

  return (
    <div className="space-y-3">
      <p className="label-caps text-muted-foreground">Cumulative spending this cycle</p>
      <p className="sr-only">{summaryParts.join(" ")}</p>
      <div className="h-56 w-full sm:h-64" aria-hidden={false}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cycleActualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6E4E91" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6E4E91" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E8DFCC" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#8A7F72" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#8A7F72" }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => formatMoney(v, currency)}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                borderColor: "#E8DFCC",
                background: "#FFFDF8",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                formatMoney(value, currency),
                name === "actual" ? "Actual" : "Projected",
              ]}
              labelFormatter={(label) => String(label)}
            />
            {planCents != null ? (
              <ReferenceLine
                y={planCents}
                stroke="#C4A35A"
                strokeDasharray="4 4"
                label={{
                  value: "PLAN",
                  position: "insideTopRight",
                  fill: "#8A7F72",
                  fontSize: 10,
                }}
              />
            ) : null}
            {todayPoint ? (
              <ReferenceLine
                x={format(parseISO(todayPoint.dateYmd), "MMM d")}
                stroke="#6E4E91"
                strokeDasharray="3 3"
                label={{
                  value: `TODAY · DAY ${todayPoint.dayIndex}`,
                  position: "insideTopLeft",
                  fill: "#6E4E91",
                  fontSize: 10,
                }}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#6E4E91"
              strokeWidth={2}
              fill="url(#cycleActualFill)"
              connectNulls={false}
              name="actual"
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="#6E4E91"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              name="projected"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          Actual today:{" "}
          <strong className="text-foreground">
            {formatMoney(pace.series.actualTodayCents, currency)}
          </strong>
        </span>
        {planCents != null ? (
          <span>
            Plan:{" "}
            <strong className="text-foreground">{formatMoney(planCents, currency)}</strong>
          </span>
        ) : null}
        {projected != null ? (
          <span>
            Projected:{" "}
            <strong className="text-foreground">
              ≈ {formatMoney(projected, currency)}
            </strong>
            {pace.projection.kind === "early_estimate" ? " (early estimate)" : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
