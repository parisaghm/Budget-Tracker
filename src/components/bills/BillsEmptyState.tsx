import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BillsEmptyStateProps {
  title?: string;
  description: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** Compact variant for inline (in-card) empty states. */
  compact?: boolean;
  className?: string;
}

export function BillsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  className,
}: BillsEmptyStateProps) {
  return (
    <div
      className={cn(
        "text-center",
        compact ? "py-6" : "py-10",
        className,
      )}
    >
      {title ? (
        <h3 className="text-base font-semibold text-[#1A1411]">{title}</h3>
      ) : null}
      <p className={cn("mx-auto max-w-sm text-sm leading-relaxed text-[#746A5D]", title && "mt-1.5")}>
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button type="button" onClick={onAction} className="mt-4 rounded-full px-5">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
