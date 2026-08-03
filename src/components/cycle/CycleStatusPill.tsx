import { cn } from "@/lib/utils";

export type PillTone = "healthy" | "caution" | "over_plan" | "info";

const toneClass: Record<PillTone, string> = {
  healthy: "bg-success/15 text-success border-success/20",
  caution: "bg-warning/15 text-warning border-warning/25",
  over_plan: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-[#F6F0E4] text-foreground/80 border-[#E8DFCC]",
};

export function CycleStatusPill({
  tone,
  children,
  className,
}: {
  tone: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-medium leading-snug",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
