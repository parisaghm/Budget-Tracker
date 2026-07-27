import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface BudgetHelperRowProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTo?: string;
  className?: string;
}

export function BudgetHelperRow({
  message,
  actionLabel = "Review",
  onAction,
  actionTo,
  className,
}: BudgetHelperRowProps) {
  const actionClass =
    "inline-flex shrink-0 items-center rounded-full border border-border/80 bg-secondary/70 px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-secondary";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-sm text-muted-foreground",
        className,
      )}
    >
      <p className="min-w-0">
        <span className="mr-1.5 text-muted-foreground/80" aria-hidden>
          •
        </span>
        {message}
      </p>
      {onAction ? (
        <button type="button" className={actionClass} onClick={onAction}>
          {actionLabel}
        </button>
      ) : actionTo ? (
        <Link to={actionTo} className={actionClass}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
