import { CategoryEmojiIcon } from '@/components/icons/CategoryEmojiIcon';
import { cn } from '@/lib/utils';

export interface BudgetIconCellProps {
  iconKey?: string | null;
  label?: string;
  className?: string;
  iconClassName?: string;
}

/** Fixed column cell with a soft cream OpenMoji icon well. */
export function BudgetIconCell({
  iconKey,
  label,
  className,
  iconClassName,
}: BudgetIconCellProps) {
  return (
    <CategoryEmojiIcon
      iconKey={iconKey}
      label={label}
      size="sm"
      decorative
      className={cn('budget-icon-cell justify-self-center', className)}
      iconClassName={iconClassName}
    />
  );
}
