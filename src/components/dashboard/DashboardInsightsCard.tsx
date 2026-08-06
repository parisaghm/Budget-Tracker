import { Link } from "react-router-dom";
import { ChevronRight, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import type { DashboardInsight } from "@/utils/dashboardInsights";
import { cn } from "@/lib/utils";

interface DashboardInsightsCardProps {
  insights: DashboardInsight[];
  /** Display-only comparison moved from the hero, e.g. "↑ 100% better than May". */
  comparisonLabel?: string | null;
  maxVisible?: number;
}

const TONE_STYLE: Record<
  DashboardInsight["tone"],
  { icon: typeof TrendingUp; className: string }
> = {
  positive: { icon: TrendingUp, className: "bg-success/15 text-success" },
  caution: { icon: Lightbulb, className: "bg-warning/15 text-warning" },
  neutral: { icon: Sparkles, className: "bg-accent text-primary" },
};

export function DashboardInsightsCard({
  insights,
  comparisonLabel = null,
  maxVisible = 3,
}: DashboardInsightsCardProps) {
  const visibleInsights = comparisonLabel
    ? insights.filter((insight) => insight.id !== "month-comparison")
    : insights;

  const comparisonInsight = comparisonLabel
    ? {
        id: "month-comparison-chip",
        message: comparisonLabel.replace(/^↑\s*/, "You're spending "),
        tone: "positive" as const,
      }
    : null;

  const displayInsights = [
    ...(comparisonInsight ? [comparisonInsight] : []),
    ...visibleInsights,
  ].slice(0, maxVisible);

  if (displayInsights.length === 0) return null;

  return (
    <section
      className="card-dashboard dashboard-card-hover dashboard-card-fill w-full rounded-[1.5rem] p-5 lg:rounded-[1.875rem] lg:p-6"
      aria-labelledby="dashboard-insights-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <h2 id="dashboard-insights-heading" className="heading-card">
              Insights
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">What to pay attention to right now</p>
        </div>
        <Link
          to="/cycle"
          className="touch-hit shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary"
        >
          View all insights →
        </Link>
      </div>

      <ul className="mt-4 space-y-2" role="list">
        {displayInsights.map((insight) => {
          const { icon: Icon, className: toneClass } = TONE_STYLE[insight.tone];
          return (
            <li key={insight.id}>
              <div className="insight-row">
                <div className={cn("insight-row__icon", toneClass)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
                  {insight.message}
                </p>
                <ChevronRight className="insight-row__chevron h-4 w-4" aria-hidden />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
