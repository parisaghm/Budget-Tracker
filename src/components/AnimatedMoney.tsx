import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/utils/money';

interface AnimatedMoneyProps {
  cents: number;
  currency?: string;
  /**
   * Optional className applied to the outer span, so the parent
   * can control typography/colour (e.g. in the hero number).
   */
  className?: string;
  /**
   * Animation duration in milliseconds.
   */
  durationMs?: number;
}

export function AnimatedMoney({
  cents,
  currency = 'EUR',
  className,
  durationMs = 600,
}: AnimatedMoneyProps) {
  const [displayCents, setDisplayCents] = useState(cents);
  const previousCentsRef = useRef(cents);

  useEffect(() => {
    const from = previousCentsRef.current;
    const to = cents;

    if (from === to) {
      return;
    }

    const start = performance.now();
    const duration = Math.max(0, durationMs);

    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = duration === 0 ? 1 : Math.min(1, elapsed / duration);

      // Ease-out cubic for a softer finish
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);

      setDisplayCents(next);

      if (t < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        previousCentsRef.current = to;
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [cents, durationMs]);

  return (
    <span className={className}>
      {formatMoney(displayCents, currency)}
    </span>
  );
}

