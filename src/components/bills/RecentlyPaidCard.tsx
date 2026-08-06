import type { RecentlyPaidItem } from "@/utils/billsPageModel";
import { RecentlyPaidRow } from "@/components/bills/RecentlyPaidRow";
import { BillsEmptyState } from "@/components/bills/BillsEmptyState";

interface RecentlyPaidCardProps {
  items: RecentlyPaidItem[];
  currency: string;
  maxVisible?: number;
}

export function RecentlyPaidCard({ items, currency, maxVisible = 6 }: RecentlyPaidCardProps) {
  const visible = items.slice(0, maxVisible);

  return (
    <section
      className="card-dashboard dashboard-card-fill w-full rounded-[1.5rem] p-5 sm:p-6 lg:rounded-[1.875rem]"
      aria-labelledby="recently-paid-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="recently-paid-heading"
          className="text-[1.125rem] font-semibold leading-snug tracking-[-0.015em] text-foreground"
        >
          Recently paid
        </h2>
        <p className="text-xs text-muted-foreground">Last 30 days</p>
      </div>

      {visible.length === 0 ? (
        <BillsEmptyState
          compact
          description="No bills have been marked paid in the last 30 days."
        />
      ) : (
        <ul className="mt-4 space-y-2.5" role="list">
          {visible.map((item) => (
            <li key={item.id}>
              <RecentlyPaidRow item={item} currency={currency} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
