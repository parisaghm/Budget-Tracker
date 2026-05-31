import { Link } from "react-router-dom";
import { ChevronRight, Heart } from "lucide-react";
import type { FinancialPace } from "@/utils/financialPace";

interface PaceGuidanceCardProps {
  pace: FinancialPace;
}

export function PaceGuidanceCard({ pace }: PaceGuidanceCardProps) {
  if (!pace.guidanceHeadline) return null;

  return (
    <section
      className="card-support pace-guidance p-6 sm:p-7"
      aria-labelledby="pace-guidance-heading"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8"
          aria-hidden
        >
          <Heart className="h-4 w-4 text-primary/75" />
        </div>
        <div className="min-w-0 flex-1">
          <p id="pace-guidance-heading" className="text-base font-medium leading-snug text-foreground">
            {pace.guidanceHeadline}
          </p>
          {pace.guidanceDetail ? (
            <p className="mt-2 text-sm leading-[1.65] text-muted-foreground">{pace.guidanceDetail}</p>
          ) : null}
        </div>
      </div>

      {pace.suggestedActions.length > 0 ? (
        <ul className="mt-5 space-y-2" role="list">
          {pace.suggestedActions.slice(0, 3).map((action) => (
            <li key={action.id}>
              <Link
                to={action.to}
                className="card-nested flex w-full items-center gap-3 px-4 py-3 text-left transition-[background-color] duration-200 hover:bg-popover/80"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground/90">{action.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
