import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompletedCycleRecap, RecapSlide, RecapPillTone } from "@/utils/cycleReviewModel";
import { formatMoney } from "@/utils/money";

const STORY_BG = "#472f8a";
const STORY_TEXT = "#f4effc";
const STORY_LAVENDER = "#a893d8";
const STORY_CREAM = "#f6f0e4";

export function CycleRecapDialog({
  open,
  onOpenChange,
  recap,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recap: CompletedCycleRecap | null;
  currency: string;
}) {
  const [index, setIndex] = useState(0);
  const slides = recap?.slides ?? [];
  const total = slides.length;
  const slide = slides[index] ?? null;
  const isLast = total > 0 && index >= total - 1;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, recap?.cycle.id]);

  useEffect(() => {
    if (!open || total === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(total - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, total]);

  const goNext = () => {
    if (isLast) onOpenChange(false);
    else setIndex((i) => Math.min(total - 1, i + 1));
  };

  const goBack = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[min(440px,100vw)] max-w-[440px] flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-2xl sm:rounded-[24px] [&>button]:hidden"
        style={{ backgroundColor: STORY_BG, color: STORY_TEXT }}
        onEscapeKeyDown={() => onOpenChange(false)}
        onPointerDownOutside={() => onOpenChange(false)}
        aria-describedby="cycle-recap-desc"
      >
        <DialogTitle className="sr-only">
          Cycle recap{recap ? ` · ${recap.rangeLabel}` : ""}
        </DialogTitle>
        <DialogDescription id="cycle-recap-desc" className="sr-only">
          Five short cards about your finished cycle. Use arrow keys or Back and Next.
        </DialogDescription>

        {/* Progress segments */}
        <div className="flex gap-1.5 px-4 pt-4" aria-hidden>
          {Array.from({ length: Math.max(total, 5) }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: "rgba(244,239,252,0.25)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: i <= index && i < total ? "100%" : "0%",
                  backgroundColor: STORY_TEXT,
                }}
              />
            </div>
          ))}
        </div>

        <div className="relative flex items-start justify-between px-4 pt-3">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: STORY_LAVENDER }}
            aria-live="polite"
          >
            {slide?.eyebrow ?? "CYCLE RECAP"}
            {total > 0 ? ` · ${index + 1} OF ${total}` : ""}
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close recap"
            style={{ color: STORY_TEXT }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[320px] flex-1 flex-col justify-center px-6 py-8 sm:min-h-[360px] sm:px-8">
          {!recap || !slide ? (
            <p className="text-center text-sm" style={{ color: STORY_LAVENDER }}>
              Your first full recap will be available when this cycle ends.
            </p>
          ) : (
            <CycleRecapSlide
              slide={slide}
              rangeLabel={recap.rangeLabel}
              currency={currency}
              showRangeOnOpening={slide.id === "opening"}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
          <button
            type="button"
            disabled={index <= 0}
            onClick={goBack}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
              borderColor: "rgba(168,147,216,0.45)",
              backgroundColor: "rgba(55,35,110,0.65)",
              color: STORY_TEXT,
            }}
          >
            Back
          </button>
          <p
            className="hidden text-[11px] sm:block"
            style={{ color: "rgba(244,239,252,0.55)" }}
          >
            ← → to move · Esc to close
          </p>
          <button
            type="button"
            onClick={goNext}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            style={{ backgroundColor: STORY_CREAM, color: STORY_BG }}
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
        <p
          className="pb-4 text-center text-[11px] sm:hidden"
          style={{ color: "rgba(244,239,252,0.55)" }}
        >
          ← → to move · Esc to close
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function CycleRecapSlide({
  slide,
  rangeLabel,
  currency,
  showRangeOnOpening,
}: {
  slide: RecapSlide;
  rangeLabel: string;
  currency: string;
  showRangeOnOpening?: boolean;
}) {
  const body = formatRecapBody(slide.body, currency);

  return (
    <article className="flex flex-col items-center text-center">
      {showRangeOnOpening ? (
        <p
          className="mb-4 text-xs font-medium uppercase tracking-wide"
          style={{ color: "rgba(244,239,252,0.85)" }}
        >
          {rangeLabel}
        </p>
      ) : null}

      {slide.heroAmountCents != null ? (
        <>
          {slide.headline ? (
            <h3
              className="font-display text-2xl font-semibold leading-tight sm:text-3xl"
              style={{ color: STORY_TEXT }}
            >
              {slide.headline}
            </h3>
          ) : null}
          <p
            className={`font-display font-semibold tabular-nums leading-none ${
              slide.headline ? "mt-4 text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"
            }`}
            style={{ color: STORY_TEXT }}
          >
            {formatMoney(slide.heroAmountCents, currency)}
          </p>
        </>
      ) : (
        <h3
          className="font-display text-3xl font-semibold leading-tight sm:text-[2.35rem]"
          style={{ color: STORY_TEXT }}
        >
          {slide.headline}
        </h3>
      )}

      {slide.pillLabel ? (
        <span
          className="mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
          style={pillStyle(slide.pillTone)}
        >
          {slide.pillLabel}
        </span>
      ) : null}

      <p
        className="mt-5 max-w-[22rem] text-base leading-relaxed sm:text-[1.05rem]"
        style={{
          color: slide.unavailable ? STORY_LAVENDER : "rgba(244,239,252,0.9)",
        }}
      >
        {body}
      </p>
    </article>
  );
}

function pillStyle(tone: RecapPillTone | undefined): React.CSSProperties {
  switch (tone) {
    case "healthy":
      return { backgroundColor: "rgba(107,127,94,0.35)", color: "#d8e8c8" };
    case "tough":
      return { backgroundColor: "rgba(168,147,216,0.28)", color: STORY_LAVENDER };
    case "caution":
      return { backgroundColor: "rgba(176,122,59,0.28)", color: "#f0d9b0" };
    default:
      return { backgroundColor: "rgba(244,239,252,0.12)", color: STORY_TEXT };
  }
}

/** Replace money tokens in recap body copy. */
export function formatRecapBody(raw: string, currency: string): string {
  return raw
    .replace(/__UNDER__(\d+)/g, (_, n) => formatMoney(Number(n), currency))
    .replace(/__OVER__(\d+)/g, (_, n) => formatMoney(Number(n), currency))
    .replace(/__PLAN__(\d+)/g, (_, n) => formatMoney(Number(n), currency))
    .replace(/__EXTRA__(\d+)/g, (_, n) => formatMoney(Number(n), currency))
    .replace(/__KEPT__(\d+)/g, (_, n) => formatMoney(Number(n), currency));
}
