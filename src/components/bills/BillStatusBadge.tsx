import { cn } from "@/lib/utils";

export type BillStatusVariant = "upcoming" | "today" | "overdue" | "paid" | "one-time";

const VARIANT_LABEL: Record<BillStatusVariant, string> = {
  upcoming: "Upcoming",
  today: "Due today",
  overdue: "Overdue",
  paid: "Paid",
  "one-time": "One-time",
};

/** Calm, non-color-only status pills. Each pill pairs a tint with a text label. */
const VARIANT_CLASS: Record<BillStatusVariant, string> = {
  upcoming: "bg-accent text-primary",
  today: "bg-warning/15 text-warning",
  overdue: "bg-destructive/15 text-destructive",
  paid: "bg-success/15 text-success",
  "one-time": "bg-muted text-muted-foreground",
};

interface BillStatusBadgeProps {
  variant: BillStatusVariant;
  label?: string;
  className?: string;
}

export function BillStatusBadge({ variant, label, className }: BillStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium leading-none",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {label ?? VARIANT_LABEL[variant]}
    </span>
  );
}
