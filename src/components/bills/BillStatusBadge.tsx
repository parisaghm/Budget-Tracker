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
  upcoming: "bg-[#EFE7F7] text-[#5B3F7A]",
  today: "bg-[#F7EDD8] text-[#8A5B1F]",
  overdue: "bg-[#F6E1DD] text-[#9A3B2E]",
  paid: "bg-[#E4F0E4] text-[#3B6B41]",
  "one-time": "bg-[#F1EBDD] text-[#6B5A3F]",
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
