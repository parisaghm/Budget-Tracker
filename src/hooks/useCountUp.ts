import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

interface UseCountUpOptions {
  duration?: number;
  enabled?: boolean;
  /** When true, animates from the previous target when the value changes. */
  animateOnChange?: boolean;
}

/**
 * Animates a number from 0 to `target` on first run when enabled.
 * With `animateOnChange`, subsequent target updates tween from the prior value.
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 600, enabled = true, animateOnChange = false } = options;
  const [value, setValue] = useState(enabled ? 0 : target);
  const prevTargetRef = useRef(target);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      prevTargetRef.current = target;
      return;
    }

    const isFirstRun = !hasAnimatedRef.current;
    let from = isFirstRun ? 0 : prevTargetRef.current;

    if (!isFirstRun && !animateOnChange) {
      setValue(target);
      prevTargetRef.current = target;
      return;
    }

    if (from === target) {
      setValue(target);
      prevTargetRef.current = target;
      hasAnimatedRef.current = true;
      return;
    }

    prevTargetRef.current = target;
    hasAnimatedRef.current = true;

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      setValue(Math.round(from + (target - from) * easeOutCubic(progress)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animateOnChange, duration, enabled, target]);

  return enabled ? value : target;
}
