import { getCategoryIconSrc, resolveCategoryIconKey } from '@/utils/categoryIcons';
import { cn } from '@/lib/utils';

const SIZE_CLASS = {
  sm: { box: 'h-8 w-8', icon: 'h-5 w-5' },
  md: { box: 'h-10 w-10', icon: 'h-5 w-5' },
} as const;

/** Soft cream well matching the Budget icon reference. */
const CREAM_BG = '#F3EBE0';

export interface CategoryEmojiIconProps {
  iconKey?: string | null;
  categoryValue?: string | null;
  label?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  iconClassName?: string;
  /** When true, hide from assistive tech (parent provides the name). */
  decorative?: boolean;
}

/**
 * Colorful OpenMoji SVG inside a soft cream rounded-square container.
 * Uses local assets — appearance is consistent across platforms.
 */
export function CategoryEmojiIcon({
  iconKey,
  categoryValue,
  label,
  size = 'sm',
  className,
  iconClassName,
  decorative = false,
}: CategoryEmojiIconProps) {
  const resolvedKey = resolveCategoryIconKey(categoryValue, { iconKey, label });
  const src = getCategoryIconSrc(resolvedKey);
  const sizeClass = SIZE_CLASS[size];
  const accessibleName = label?.trim() || undefined;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl',
        sizeClass.box,
        className,
      )}
      style={{ backgroundColor: CREAM_BG }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : accessibleName}
      aria-hidden={decorative || !accessibleName ? true : undefined}
      title={accessibleName}
    >
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        draggable={false}
        className={cn(sizeClass.icon, 'object-contain select-none', iconClassName)}
      />
    </div>
  );
}
