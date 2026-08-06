import type { CalendarDayActivity } from "@/utils/billsPageModel";
import { cn } from "@/lib/utils";

interface BillsCalendarDayProps {
  date: string;
  dayNumber: number;
  activity?: CalendarDayActivity;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: string) => void;
}

interface Marker {
  key: string;
  className: string;
  label: string;
}

function buildMarkers(activity?: CalendarDayActivity): Marker[] {
  if (!activity) return [];
  const markers: Marker[] = [];
  if (activity.overdueCount > 0) {
    markers.push({ key: "overdue", className: "bg-destructive", label: "overdue" });
  }
  if (activity.dueTodayCount > 0) {
    markers.push({ key: "today", className: "bg-warning", label: "due today" });
  }
  if (activity.upcomingCount > 0) {
    markers.push({ key: "upcoming", className: "bg-primary", label: "upcoming" });
  }
  if (activity.paidCount > 0) {
    markers.push({ key: "paid", className: "bg-success", label: "paid" });
  }
  return markers;
}

export function BillsCalendarDay({
  date,
  dayNumber,
  activity,
  isToday,
  isSelected,
  onSelect,
}: BillsCalendarDayProps) {
  const markers = buildMarkers(activity);
  const total =
    (activity?.overdueCount ?? 0) +
    (activity?.dueTodayCount ?? 0) +
    (activity?.upcomingCount ?? 0) +
    (activity?.paidCount ?? 0);
  const hasActivity = total > 0;
  const summary = hasActivity ? ` · ${markers.map((m) => m.label).join(", ")}` : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-pressed={isSelected}
      aria-label={`${dayNumber}${isToday ? " (today)" : ""}${summary}`}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted",
        !isSelected && isToday && "ring-1 ring-inset ring-primary/50",
        !isSelected && hasActivity && "bg-accent/40",
      )}
    >
      <span className={cn("leading-none", isToday && !isSelected && "font-semibold")}>
        {dayNumber}
      </span>
      {markers.length > 0 ? (
        <span className="mt-1 flex items-center gap-0.5" aria-hidden>
          {markers.slice(0, 3).map((marker) => (
            <span
              key={marker.key}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isSelected ? "bg-primary-foreground/90" : marker.className,
              )}
            />
          ))}
          {total > 3 ? (
            <span className={cn("ml-0.5 text-[0.5625rem] leading-none", isSelected ? "text-primary-foreground/90" : "text-muted-foreground")}>
              +{total - 3}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
