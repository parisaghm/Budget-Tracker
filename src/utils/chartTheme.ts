/**
 * Shared chart theme tokens for Recharts and custom SVG charts.
 * Values resolve from CSS variables so light/dark stay in sync.
 */
export type ChartTheme = {
  grid: string;
  axis: string;
  primary: string;
  secondary: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  muted: string;
  foreground: string;
  border: string;
  card: string;
};

/** CSS color strings that track the active theme via variables. */
export function getChartTheme(): ChartTheme {
  return {
    grid: "hsl(var(--chart-grid))",
    axis: "hsl(var(--chart-axis))",
    primary: "hsl(var(--chart-primary))",
    secondary: "hsl(var(--chart-secondary))",
    tooltipBg: "hsl(var(--chart-tooltip-bg))",
    tooltipBorder: "hsl(var(--chart-tooltip-border))",
    tooltipText: "hsl(var(--chart-tooltip-text))",
    muted: "hsl(var(--muted-foreground))",
    foreground: "hsl(var(--foreground))",
    border: "hsl(var(--border))",
    card: "hsl(var(--card))",
  };
}
