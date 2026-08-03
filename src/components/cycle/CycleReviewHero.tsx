import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CycleStatusPill } from "@/components/cycle/CycleStatusPill";
import type { HeroModel } from "@/utils/cycleReviewModel";
import { formatMoney } from "@/utils/money";

export function CycleReviewHero({
  hero,
  actualSpentCents,
  safeToSpendCents,
  plannedSavingsCents,
  actualContributionsCents,
  currency,
  onPlayRecap,
}: {
  hero: HeroModel;
  actualSpentCents: number;
  safeToSpendCents: number;
  plannedSavingsCents: number;
  actualContributionsCents: number;
  currency: string;
  onPlayRecap: (completedCycleId: string | null) => void;
}) {
  const supporting =
    hero.tone === "no_income"
      ? null
      : buildSupporting({
          actualSpentCents,
          safeToSpendCents,
          plannedSavingsCents,
          actualContributionsCents,
          currency,
        });

  return (
    <section
      className="card-plan-hero overflow-hidden rounded-[1.5rem] border border-[#E8DFCC] p-5 sm:p-7"
      aria-labelledby="cycle-review-heading"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="label-caps text-muted-foreground">{hero.label}</p>
          <h1
            id="cycle-review-heading"
            className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            {hero.heading}
          </h1>
          {supporting ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {supporting}
            </p>
          ) : null}
          {hero.pills.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {hero.pills.map((pill) => (
                <CycleStatusPill key={pill.id} tone={pill.tone}>
                  {pill.text}
                </CycleStatusPill>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-center lg:min-w-[220px]">
          <Button
            type="button"
            size="lg"
            className="rounded-full bg-[#472f8a] px-6 text-white shadow-md shadow-primary/20 hover:bg-[#3d2878]"
            onClick={() => onPlayRecap(hero.recapCta.completedCycleId)}
            aria-label={
              hero.recapCta.kind === "play"
                ? "Play cycle recap for last finished cycle"
                : "Preview cycle recap"
            }
          >
            <Play className="mr-2 h-4 w-4 fill-current" aria-hidden />
            {hero.recapCta.buttonLabel}
          </Button>
          <p className="max-w-[240px] text-center text-xs leading-relaxed text-muted-foreground">
            {hero.recapCta.caption}
          </p>
        </div>
      </div>
    </section>
  );
}

function buildSupporting(params: {
  actualSpentCents: number;
  safeToSpendCents: number;
  plannedSavingsCents: number;
  actualContributionsCents: number;
  currency: string;
}): string {
  const spent = formatMoney(params.actualSpentCents, params.currency);
  const sts = formatMoney(Math.max(0, params.safeToSpendCents), params.currency);
  const plan = formatMoney(params.plannedSavingsCents, params.currency);

  if (params.plannedSavingsCents <= 0) {
    return `${spent} spent so far — ${sts} still safe to spend. Savings plan not set.`;
  }

  if (params.actualContributionsCents >= params.plannedSavingsCents) {
    return `${spent} spent so far — ${sts} still safe to spend, and your savings plan of ${plan} has contributions recorded.`;
  }

  return `${spent} spent so far — ${sts} still safe to spend, and your savings plan of ${plan} is reserved.`;
}
