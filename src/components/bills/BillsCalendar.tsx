import { useMemo } from "react";
import { eachDayOfInterval, endOfMonth, format, getDay, parse, startOfDay, startOfMonth } from "date-fns";
import type { CalendarDayActivity } from "@/utils/billsPageModel";
import { BillsCalendarDay } from "@/components/bills/BillsCalendarDay";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface BillsCalendarProps {
  /** Selected month key (YYYY-MM). */
  month: string;
  calendarEvents: Record<string, CalendarDayActivity>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  today?: Date;
}

export function BillsCalendar({
  month,
  calendarEvents,
  selectedDate,
  onSelectDate,
  today = new Date(),
}: BillsCalendarProps) {
  const monthStart = useMemo(() => startOfMonth(parse(`${month}-01`, "yyyy-MM-dd", new Date())), [month]);
  const monthLabel = format(monthStart, "MMMM");
  const todayIso = format(startOfDay(today), "yyyy-MM-dd");

  const cells = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) });
    // Monday-first offset (getDay: 0 = Sunday).
    const leading = (getDay(monthStart) + 6) % 7;
    return { leading, days };
  }, [monthStart]);

  return (
    <section
      className="card-dashboard dashboard-card-fill w-full rounded-[1.5rem] p-5 sm:p-6 lg:rounded-[1.875rem]"
      aria-labelledby="bills-calendar-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="bills-calendar-heading"
          className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-[#1A1411]"
        >
          {monthLabel} at a glance
        </h2>
        <p className="text-xs text-[#9C9284]">Bills · paid · upcoming</p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={`${label}-${index}`} className="pb-1 text-[0.6875rem] font-medium text-[#9C9284]">
            {label}
          </div>
        ))}
        {Array.from({ length: cells.leading }).map((_, index) => (
          <div key={`lead-${index}`} aria-hidden />
        ))}
        {cells.days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          return (
            <BillsCalendarDay
              key={iso}
              date={iso}
              dayNumber={day.getDate()}
              activity={calendarEvents[iso]}
              isToday={iso === todayIso}
              isSelected={iso === selectedDate}
              onSelect={(date) => onSelectDate(date === selectedDate ? null : date)}
            />
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#746A5D]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6E4E91]" aria-hidden /> Upcoming
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3B6B41]" aria-hidden /> Paid
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C0574A]" aria-hidden /> Overdue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-[#6E4E91]/50" aria-hidden /> Today
        </span>
      </div>
    </section>
  );
}
