import { useState } from "react";
import {
  categoryStatusLabel,
  resolveCategoryBudgetStatus,
  type CategoryBudgetStatus,
} from "@/utils/categoryBudgetStatus";
import { formatMoney } from "@/utils/money";
import { CategoryLimitPopover } from "@/components/budget/CategoryLimitPopover";
import { CategoryIconAvatar } from "@/components/CategoryIconAvatar";

function getProgressFillColor(
  status: CategoryBudgetStatus | null,
  fallbackBar: string,
): string {
  if (status === "over" || status === "close") return "hsl(var(--destructive))";
  if (status === "under") return "hsl(var(--segment-spent))";
  return fallbackBar;
}

export interface SpendingCategoryRowProps {
  categoryValue?: string;
  categoryLabel: string;
  iconKey: string;
  iconBg: string;
  fallbackBarColor: string;
  spentCents: number;
  limitCents?: number;
  currency?: string;
  paletteIndex?: number;
  onSetCategoryLimit?: (limitCents: number) => void;
}

export function SpendingCategoryRow({
  categoryValue,
  categoryLabel,
  iconKey,
  iconBg,
  fallbackBarColor,
  spentCents,
  limitCents,
  currency = "EUR",
  paletteIndex,
  onSetCategoryLimit,
}: SpendingCategoryRowProps) {
  const hasLimit = limitCents != null && limitCents > 0;
  const pct =
    hasLimit && limitCents > 0
      ? Math.min(100, Math.round((spentCents / limitCents) * 100))
      : 0;
  const status = resolveCategoryBudgetStatus(spentCents, limitCents);
  const fillColor = getProgressFillColor(status, fallbackBarColor);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="spending-category-row flex items-start gap-3">
      <CategoryIconAvatar
        categoryValue={categoryValue}
        iconKey={iconKey}
        label={categoryLabel}
        paletteIndex={paletteIndex}
        backgroundColor={iconBg}
        size="sm"
      />
      <div className="spending-category-row__body min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold leading-tight text-foreground">{categoryLabel}</p>
          <p className="money-display shrink-0 text-sm sm:text-base">
            {formatMoney(spentCents, currency)}
            {hasLimit ? (
              <span className="text-muted-foreground">
                {" "}
                / {formatMoney(limitCents, currency)}
              </span>
            ) : null}
          </p>
        </div>

        {hasLimit ? (
          <div className="spending-category-row__track progress-track mt-2 h-2">
            <div
              className="spending-category-row__fill h-2 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: fillColor,
              }}
            />
          </div>
        ) : null}

        <p className="mt-1 text-xs text-muted-foreground">
          {categoryStatusLabel(spentCents, limitCents, currency, formatMoney)}
        </p>

        {onSetCategoryLimit ? (
          <div className="mt-2">
            <CategoryLimitPopover
              categoryLabel={categoryLabel}
              currency={currency}
              currentLimitCents={limitCents ?? 0}
              onSave={onSetCategoryLimit}
              variant="text"
              open={editOpen}
              onOpenChange={setEditOpen}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
