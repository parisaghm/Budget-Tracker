import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY_PREFIX = "sova_cycle_recap_banner_dismissed_";

export function cycleRecapBannerDismissKey(cycleId: string): string {
  return `${DISMISS_KEY_PREFIX}${cycleId}`;
}

export function isCycleRecapBannerDismissed(cycleId: string): boolean {
  try {
    return localStorage.getItem(cycleRecapBannerDismissKey(cycleId)) === "1";
  } catch {
    return false;
  }
}

export function dismissCycleRecapBanner(cycleId: string): void {
  try {
    localStorage.setItem(cycleRecapBannerDismissKey(cycleId), "1");
  } catch {
    /* ignore */
  }
}

export function CycleRecapOfferBanner({
  rangeLabel,
  onPlay,
  onDismiss,
}: {
  rangeLabel: string;
  onPlay: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="card-dashboard flex flex-col gap-3 rounded-[1.25rem] border border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          Your {rangeLabel} cycle is finished
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A calm 30-second look back — offered once, never forced.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          onClick={onPlay}
          aria-label={`Play recap for ${rangeLabel}`}
        >
          <Play className="mr-1.5 h-3.5 w-3.5 fill-current" aria-hidden />
          Play recap (30 sec)
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onDismiss}
          aria-label="Dismiss cycle recap offer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
