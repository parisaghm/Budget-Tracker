import { IncomeCycleSettings } from "@/components/IncomeCycleSettings";
import { SettingsSection } from "@/components/settings/SettingsSection";
import {
  INCOME_CYCLE_PRESET_LABELS,
  INCOME_CYCLE_SETUP_MESSAGE,
  type IncomeCycle,
} from "@/types/incomeCycle";
import type { BudgetCycle } from "@/types/budgetCycle";
import {
  formatIncomeDateLabel,
  getActiveCycleWindow,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { computeCycleEndIso, scheduleTypeFromIncomeCycle } from "@/utils/budgetCycles";
import { format, parseISO } from "date-fns";

type CycleSettingsCardProps = {
  incomeCycle: IncomeCycle | null;
  isConfigured: boolean;
  onChange: (cycle: IncomeCycle | null) => void;
  selectedCycle: BudgetCycle | null;
};

type PreviewRow = {
  key: string;
  label: string;
  value: string;
  hint?: string;
};

type CyclePreview = {
  kind: "matching" | "transition";
  rows: PreviewRow[];
};

function formatRangeLabel(startIso: string, endIso: string): string {
  return `${formatIncomeDateLabel(parseISO(startIso))} – ${formatIncomeDateLabel(parseISO(endIso))}`;
}

function scheduleDisplayLabel(cycle: IncomeCycle): string {
  if (cycle.preset === "custom") {
    return `Day ${cycle.day ?? 1} of every month`;
  }
  return INCOME_CYCLE_PRESET_LABELS[cycle.preset];
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function buildCyclePreview(
  incomeCycle: IncomeCycle | null,
  selectedCycle: BudgetCycle | null,
): CyclePreview | null {
  if (!incomeCycle || !isIncomeCycleConfigured(incomeCycle)) return null;

  const preferenceSchedule = scheduleTypeFromIncomeCycle(incomeCycle);

  if (selectedCycle?.startDate && selectedCycle?.endDate) {
    const currentStart = selectedCycle.startDate.slice(0, 10);
    const currentEnd = selectedCycle.endDate.slice(0, 10);
    const currentRange = formatRangeLabel(currentStart, currentEnd);
    const scheduleMatches = selectedCycle.scheduleType === preferenceSchedule;

    if (scheduleMatches) {
      const nextEnd = computeCycleEndIso(incomeCycle, currentEnd);
      return {
        kind: "matching",
        rows: [
          {
            key: "current",
            label: "Current cycle",
            value: currentRange,
            hint: "Frozen active window",
          },
          {
            key: "next",
            label: "Next cycle",
            value: formatRangeLabel(currentEnd, nextEnd),
            hint: "Next cycle preview",
          },
        ],
      };
    }

    const transitionEnd = computeCycleEndIso(incomeCycle, currentEnd);
    const firstRegularEnd = computeCycleEndIso(incomeCycle, transitionEnd);

    return {
      kind: "transition",
      rows: [
        {
          key: "current",
          label: "Current frozen cycle",
          value: currentRange,
          hint: "Frozen active window",
        },
        {
          key: "schedule",
          label: "New schedule",
          value: scheduleDisplayLabel(incomeCycle),
        },
        {
          key: "transition",
          label: "Planned transition",
          value: formatRangeLabel(currentEnd, transitionEnd),
          hint: "Next cycle preview — created when this cycle ends",
        },
        {
          key: "regular",
          label: "First full cycle on this schedule",
          value: formatRangeLabel(transitionEnd, firstRegularEnd),
          hint: "First regular cycle",
        },
      ],
    };
  }

  // No frozen cycle yet (demo / bootstrap): preview from preference window only.
  const { start, end } = getActiveCycleWindow(incomeCycle);
  const startIso = toIsoDate(start);
  const endIso = toIsoDate(end);
  const nextEnd = computeCycleEndIso(incomeCycle, endIso);

  return {
    kind: "matching",
    rows: [
      {
        key: "current",
        label: "Current cycle",
        value: formatRangeLabel(startIso, endIso),
      },
      {
        key: "next",
        label: "Next cycle",
        value: formatRangeLabel(endIso, nextEnd),
        hint: "Next cycle preview",
      },
    ],
  };
}

function CyclePreviewPanel({ preview }: { preview: CyclePreview }) {
  return (
    <div
      className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 sm:px-4 sm:py-4"
      aria-live="polite"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {preview.kind === "transition" ? "Schedule change preview" : "Cycle preview"}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {preview.kind === "transition"
            ? "Your current cycle is frozen so its income, expenses, bills, and reports stay consistent. The new schedule starts after this cycle ends."
            : "Your current cycle is frozen so its income, expenses, bills, and reports stay consistent."}
        </p>
      </div>

      <dl
        className={
          preview.kind === "transition"
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-3 sm:grid-cols-2"
        }
      >
        {preview.rows.map((row) => (
          <div
            key={row.key}
            className="min-w-0 rounded-lg border border-border/70 bg-background/80 px-3 py-2.5"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {row.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold leading-snug text-foreground">{row.value}</dd>
            {row.hint ? (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{row.hint}</p>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CycleSettingsCard({
  incomeCycle,
  isConfigured,
  onChange,
  selectedCycle,
}: CycleSettingsCardProps) {
  const preview = buildCyclePreview(incomeCycle, selectedCycle);

  return (
    <SettingsSection
      id="cycle"
      title="Cycle"
      description="Your active cycle stays unchanged. New cycle settings apply only after it ends."
    >
      {!isConfigured ? (
        <p className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {INCOME_CYCLE_SETUP_MESSAGE}
        </p>
      ) : null}

      <IncomeCycleSettings value={incomeCycle} onChange={onChange} />

      {preview ? <CyclePreviewPanel preview={preview} /> : null}
    </SettingsSection>
  );
}
