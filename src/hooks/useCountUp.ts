import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

interface UseCountUpOptions {
  duration?: number;
  enabled?: boolean;
}

/**
 * Animates a number from 0 to `target` once when enabled.
 * Returns the target immediately when animation is disabled.
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 600, enabled = true } = options;
  const [value, setValue] = useState(enabled ? 0 : target);
  const hasRunRef = useRef(false);
  const wasEnabledRef = useRef(enabled);

  useEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false;
      setValue(target);
      return;
    }

    if (!wasEnabledRef.current) {
      hasRunRef.current = false;
      setValue(0);
    }
    wasEnabledRef.current = true;

    if (hasRunRef.current) {
      setValue(target);
      return;
    }

    hasRunRef.current = true;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      setValue(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, enabled, target]);

  return enabled ? value : target;
}
