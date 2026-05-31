import { formatMoney, getCurrencySymbol } from "@/utils/money";

interface HeroMoneyProps {
  cents: number;
  currency?: string;
  className?: string;
  /** When true, decimal portion renders smaller and muted (screenshot hero style). */
  splitDecimals?: boolean;
}

/**
 * Editorial currency display for plan heroes — large serif whole amount with a
 * subtle, muted decimal tail (matching the Sova design language).
 */
export function HeroMoney({
  cents,
  currency = "EUR",
  className = "",
  splitDecimals = true,
}: HeroMoneyProps) {
  const formatted = formatMoney(cents, currency);
  const symbol = getCurrencySymbol(currency);

  if (!splitDecimals) {
    return <span className={className}>{formatted}</span>;
  }

  const numeric = formatted.replace(symbol, "").trim();
  const dotIndex = numeric.lastIndexOf(".");
  const commaIndex = numeric.lastIndexOf(",");
  const sepIndex = Math.max(dotIndex, commaIndex);

  if (sepIndex === -1) {
    return (
      <span className={className}>
        {symbol}
        {numeric}
      </span>
    );
  }

  const whole = numeric.slice(0, sepIndex);
  const fraction = numeric.slice(sepIndex);

  return (
    <span className={className}>
      <span>
        {symbol}
        {whole}
      </span>
      <span className="money-hero-fraction ml-[0.06em] align-baseline text-[0.44em] tracking-normal">
        {fraction}
      </span>
    </span>
  );
}
