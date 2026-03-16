import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatMonth } from '@/utils/money';

interface MonthSelectorProps {
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export function MonthSelector({ currentMonth, onMonthChange }: MonthSelectorProps) {
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    if (direction === 'prev') date.setMonth(date.getMonth() - 1);
    else date.setMonth(date.getMonth() + 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(newMonth);
  };

  return (
    <div className="flex w-full sm:w-auto items-center justify-between sm:justify-center gap-2">
      <button
        onClick={() => navigateMonth('prev')}
        className="btn-icon w-10 h-10"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div className="flex flex-1 sm:flex-none items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-secondary/90 border border-border/70 shadow-md min-w-0">
        <Calendar className="w-4 h-4 text-primary shrink-0" />
        <span className="font-semibold text-sm sm:text-base truncate">
          {formatMonth(currentMonth)}
        </span>
      </div>
      <button
        onClick={() => navigateMonth('next')}
        className="btn-icon w-10 h-10"
        aria-label="Next month"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
