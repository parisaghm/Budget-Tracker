import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { IncomeCycle } from "@/types/incomeCycle";
import { formatMonth, getPreviousMonth } from "@/utils/money";
import {
  formatBudgetMonthSelectorLabel,
  isIncomeCycleConfigured,
} from "@/utils/incomeCycle";
import { cn } from "@/lib/utils";

interface MonthSelectorProps {
  currentMonth: string;
  onMonthChange: (month: string) => void;
  incomeCycle?: IncomeCycle | null;
  variant?: "default" | "mobile";
}

function getNextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthSelector({
  currentMonth,
  onMonthChange,
  incomeCycle = null,
  variant = "default",
}: MonthSelectorProps) {
  const cycleConfigured = isIncomeCycleConfigured(incomeCycle);

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth =
      direction === "prev" ? getPreviousMonth(currentMonth) : getNextMonthKey(currentMonth);
    onMonthChange(newMonth);
  };

  const label = cycleConfigured
    ? formatBudgetMonthSelectorLabel(incomeCycle, currentMonth)
    : formatMonth(currentMonth);

  const isMobile = variant === "mobile";
  const navBtnClass = cn(
    "touch-hit inline-flex shrink-0 items-center justify-center rounded-full text-[#746A5D] transition-colors hover:bg-[#EFE7F7] hover:text-[#4A3463]",
    isMobile ? "h-11 w-11" : "h-9 w-9",
  );
  const pillClass = cn(
    "flex min-w-0 items-center justify-center gap-2 rounded-full border border-[#E8DFCC] bg-[#FFFDF8]",
    isMobile ? "min-h-12 flex-1 px-4 py-3" : "flex-1 px-4 py-1.5 sm:flex-none sm:px-5 sm:py-2",
  );

  const prevLabel = cycleConfigured ? "Previous cycle" : "Previous month";
  const nextLabel = cycleConfigured ? "Next cycle" : "Next month";

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-2",
        !isMobile && "gap-1.5 sm:w-auto sm:justify-center sm:gap-1.5",
      )}
    >
      <button
        type="button"
        onClick={() => navigateMonth("prev")}
        className={navBtnClass}
        aria-label={prevLabel}
      >
        <ChevronLeft className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      <div className={pillClass}>
        <Calendar className="h-4 w-4 shrink-0 text-[#6E4E91]" aria-hidden />
        <span
          className={cn(
            "truncate font-medium text-[#1A1411]",
            isMobile ? "text-base" : "text-sm",
          )}
          title={label}
        >
          {label}
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigateMonth("next")}
        className={navBtnClass}
        aria-label={nextLabel}
      >
        <ChevronRight className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
      </button>
    </div>
  );
}
