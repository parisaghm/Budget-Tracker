import type { RecentlyPaidItem } from "@/utils/billsPageModel";
import { getRecentlyPaidRecurrenceLabel } from "@/utils/billsPageModel";
import { formatMoney } from "@/utils/money";
import { formatBillDueDateLabel } from "@/utils/recurringBills";
import { CategoryIconAvatar } from "@/components/CategoryIconAvatar";
import { BillStatusBadge } from "@/components/bills/BillStatusBadge";

interface RecentlyPaidRowProps {
  item: RecentlyPaidItem;
  currency: string;
}

export function RecentlyPaidRow({ item, currency }: RecentlyPaidRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#EAF0E6] bg-[#F6FAF4] p-3.5">
      <CategoryIconAvatar categoryValue={item.category} label={item.name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#1A1411]">{item.name}</p>
          <BillStatusBadge variant="paid" />
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-[#746A5D]">
          {formatBillDueDateLabel(item.paidDate)} · {getRecentlyPaidRecurrenceLabel(item)}
        </p>
      </div>
      <span className="money-amount-sm shrink-0 text-[0.9375rem] font-semibold text-[#1A1411]">
        {formatMoney(item.amountCents, currency)}
      </span>
    </div>
  );
}
