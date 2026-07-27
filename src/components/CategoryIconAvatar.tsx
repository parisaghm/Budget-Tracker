import { CategoryEmojiIcon } from '@/components/icons/CategoryEmojiIcon';
import { cn } from '@/lib/utils';

const SIZE_CLASS = {
  sm: 'sm',
  md: 'md',
} as const;

export interface CategoryIconAvatarProps {
  categoryValue?: string | null;
  iconKey?: string | null;
  label?: string;
  paletteIndex?: number;
  backgroundColor?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  iconClassName?: string;
}

/**
 * Shared category icon avatar — OpenMoji in a cream rounded well.
 * paletteIndex / backgroundColor are accepted for API compatibility but
 * the cream well is used so icons match the Budget reference.
 */
export function CategoryIconAvatar({
  categoryValue,
  iconKey,
  label,
  size = 'sm',
  className,
  iconClassName,
}: CategoryIconAvatarProps) {
  return (
    <CategoryEmojiIcon
      categoryValue={categoryValue}
      iconKey={iconKey}
      label={label}
      size={size}
      decorative
      className={cn(className)}
      iconClassName={iconClassName}
    />
  );
}
