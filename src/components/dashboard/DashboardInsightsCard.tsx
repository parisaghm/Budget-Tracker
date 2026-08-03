import { Link } from "react-router-dom";
import { ChevronRight, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import type { DashboardInsight } from "@/utils/dashboardInsights";

interface DashboardInsightsCardProps {
  insights: DashboardInsight[];
  /** Display-only comparison moved from the hero, e.g. "↑ 100% better than May". */
  comparisonLabel?: string | null;
  maxVisible?: number;
}

const TONE_STYLE: Record<
  DashboardInsight["tone"],
  { icon: typeof TrendingUp; bg: string; color: string }
> = {
  positive: { icon: TrendingUp, bg: "hsl(96 22% 88%)", color: "#4A5C40" },
  caution: { icon: Lightbulb, bg: "hsl(40 62% 90%)", color: "#B07A3B" },
  neutral: { icon: Sparkles, bg: "#EFE7F7", color: "#6E4E91" },
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
            <Sparkles className="h-4 w-4 text-[#6E4E91]" aria-hidden />
            <h2 id="dashboard-insights-heading" className="heading-card">
              Insights
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">What to pay attention to right now</p>
        </div>
        <Link
          to="/cycle"
          className="touch-hit shrink-0 text-sm font-medium text-[#6E4E91] transition-colors hover:text-[#4A3463]"
        >
          View all insights →
        </Link>
      </div>

      <ul className="mt-4 space-y-2" role="list">
        {displayInsights.map((insight) => {
          const { icon: Icon, bg, color } = TONE_STYLE[insight.tone];
          return (
            <li key={insight.id}>
              <div className="insight-row">
                <div
                  className="insight-row__icon"
                  style={{ backgroundColor: bg, color }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-[#2B221B]">
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
