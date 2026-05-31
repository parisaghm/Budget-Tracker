import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatMonth } from "@/utils/money";

interface MonthSelectorProps {
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export function MonthSelector({ currentMonth, onMonthChange }: MonthSelectorProps) {
  const navigateMonth = (direction: "prev" | "next") => {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(year, month - 1);
    if (direction === "prev") date.setMonth(date.getMonth() - 1);
    else date.setMonth(date.getMonth() + 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    onMonthChange(newMonth);
  };

  return (
    <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-center sm:gap-1.5">
      <button
        onClick={() => navigateMonth("prev")}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#746A5D] transition-colors hover:bg-[#EFE7F7] hover:text-[#4A3463]"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-[#E8DFCC] bg-[#FFFDF8] px-4 py-1.5 sm:flex-none sm:px-5 sm:py-2">
        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#6E4E91]" aria-hidden />
        <span className="truncate text-sm font-medium text-[#1A1411]">{formatMonth(currentMonth)}</span>
      </div>
      <button
        onClick={() => navigateMonth("next")}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#746A5D] transition-colors hover:bg-[#EFE7F7] hover:text-[#4A3463]"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
