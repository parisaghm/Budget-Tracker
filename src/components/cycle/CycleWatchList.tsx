import { Link } from "react-router-dom";
import { FileText, Leaf, TrendingUp, Utensils, Wallet } from "lucide-react";
import {
  formatWatchExplanation,
  type WatchItem,
} from "@/utils/cycleReviewModel";
import { formatMoney } from "@/utils/money";

const iconMap = {
  utensils: Utensils,
  file: FileText,
  leaf: Leaf,
  pace: TrendingUp,
  wallet: Wallet,
} as const;

const toneBg = {
  caution: "bg-warning/15 text-warning",
  info: "bg-primary/10 text-primary",
  healthy: "bg-success/15 text-success",
} as const;

export function CycleWatchList({
  title,
  items,
  currency,
}: {
  title: string;
  items: WatchItem[];
  currency: string;
}) {
  const fmt = (cents: number) => formatMoney(cents, currency);

  return (
    <section className="card-dashboard space-y-4 rounded-[1.5rem] border border-border p-5 sm:p-6">
      <header>
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Three things worth a look while the cycle is still open.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-card/80 px-4 py-3 text-sm text-muted-foreground">
          Nothing urgent to watch right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <CycleWatchItem key={item.id} item={item} formatMoneyFn={fmt} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function CycleWatchItem({
  item,
  formatMoneyFn,
}: {
  item: WatchItem;
  formatMoneyFn: (cents: number) => string;
}) {
  const Icon = iconMap[item.icon];
  const title =
    item.titleAmountCents != null
      ? item.title.replace("{0}", formatMoneyFn(item.titleAmountCents))
      : item.title;
  const explanation = formatWatchExplanation(item, formatMoneyFn);

  return (
    <li className="rounded-2xl bg-card/70 p-4">
      <div className="flex gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneBg[item.tone]}`}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{explanation}</p>
          {item.actionLabel && item.actionTo ? (
            <Link
              to={item.actionTo}
              className="inline-block pt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              {item.actionLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
