import { HeroMoney } from "@/components/budget/HeroMoney";
import { useCountUp } from "@/hooks/useCountUp";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatMoney } from "@/utils/money";

interface AnimatedMoneyProps {
  cents: number;
  currency?: string;
  className?: string;
  splitDecimals?: boolean;
  /** Run count-up on first mount when true. */
  animateOnMount?: boolean;
  /** Re-animate when `cents` changes (from the previous displayed value). */
  animateOnChange?: boolean;
  duration?: number;
  /** Compact display variant for inline amounts. */
  variant?: "hero" | "inline";
}

/**
 * Money display with a one-time ease-out count-up on mount.
 */
export function AnimatedMoney({
  cents,
  currency = "EUR",
  className = "",
  splitDecimals = true,
  animateOnMount = true,
  animateOnChange = false,
  duration = 600,
  variant = "hero",
}: AnimatedMoneyProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animateOnMount && !prefersReducedMotion;
  const displayCents = useCountUp(cents, {
    duration,
    enabled: shouldAnimate,
    animateOnChange: animateOnChange && !prefersReducedMotion,
  });

  if (variant === "inline") {
    return (
      <span className={className}>{formatMoney(displayCents, currency)}</span>
    );
  }

  return (
    <HeroMoney
      cents={displayCents}
      currency={currency}
      className={className}
      splitDecimals={splitDecimals}
    />
  );
}
