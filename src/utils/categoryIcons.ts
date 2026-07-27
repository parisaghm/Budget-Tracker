import {
  CATEGORY_ICON_SRC,
  DEFAULT_CATEGORY_ICON_KEY,
  getCategoryIconSrc,
  type IconKey,
} from '@/utils/categoryIconMap';

export {
  CATEGORY_ICON_SRC,
  DEFAULT_CATEGORY_ICON_KEY,
  getCategoryIconSrc,
  ICON_KEYS,
  type IconKey,
} from '@/utils/categoryIconMap';

/**
 * Stable category value → icon key mapping (snake_case values).
 * Used across Budget, Expenses, Dashboard, and Bills.
 */
export const CATEGORY_VALUE_ICON_MAP: Record<string, IconKey> = {
  groceries: 'shopping-cart',
  dining_out: 'food',
  eating_out: 'food',
  transport: 'car',
  baby: 'baby',
  rent: 'home',
  utilities: 'zap',
  internet: 'wifi',
  insurance: 'shield',
  subscriptions: 'credit-card',
  gifts: 'gift',
  gifts_fund: 'gift',
  health: 'heart-pulse',
  medicine: 'heart-pulse',
  shopping: 'shopping-cart',
  entertainment: 'film',
  other: 'wallet',
  food: 'food',
  home: 'home',
  car: 'car',
};

export function normalizeCategoryKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '_');
}

/** @deprecated Prefer getCategoryIconSrc — kept as alias for gradual call-site updates. */
export function getCategoryIcon(iconKey?: string | null): string {
  return getCategoryIconSrc(iconKey);
}

export function getCategoryIconForCategory(category: {
  value: string;
  label: string;
  iconKey?: string | null;
}): string {
  return getCategoryIconSrc(
    resolveCategoryIconKey(category.value, {
      iconKey: category.iconKey,
      label: category.label,
    }),
  );
}

/**
 * Resolve the best icon key for a category row.
 * Priority: explicit iconKey → category value map → label inference → wallet.
 */
export function resolveCategoryIconKey(
  categoryValue?: string | null,
  options?: { label?: string; iconKey?: string | null },
): IconKey {
  if (options?.iconKey && options.iconKey in CATEGORY_ICON_SRC) {
    return options.iconKey as IconKey;
  }

  if (categoryValue) {
    const mapped = CATEGORY_VALUE_ICON_MAP[normalizeCategoryKey(categoryValue)];
    if (mapped) return mapped;
  }

  if (options?.label) {
    return inferIconKeyFromLabel(options.label);
  }

  return DEFAULT_CATEGORY_ICON_KEY;
}

/** Infer icon for income source labels (salary, freelance, etc.). */
export function inferIncomeIconKey(label: string): IconKey {
  const lower = label.toLowerCase();
  if (lower.includes('salary') || lower.includes('wage') || lower.includes('paycheck') || lower.includes('payroll')) {
    return 'briefcase';
  }
  if (
    lower.includes('freelance') ||
    lower.includes('contract') ||
    lower.includes('consult') ||
    lower.includes('side hustle') ||
    lower.includes('client')
  ) {
    return 'laptop';
  }
  if (lower.includes('gift') || lower.includes('bonus')) {
    return 'gift';
  }
  return 'wallet';
}

export function inferIconKeyFromLabel(label: string): IconKey {
  const lower = label.toLowerCase();

  if (lower.includes('clothes') || lower.includes('clothing') || lower.includes('fashion')) {
    return 'shirt';
  }

  if (lower.includes('rent') || lower.includes('home') || lower.includes('house')) {
    return 'home';
  }

  if (lower.includes('baby') || lower.includes('childcare') || lower.includes('nursery')) {
    return 'baby';
  }

  if (lower.includes('grocery') || lower.includes('groceries')) {
    return 'shopping-cart';
  }

  if (
    lower.includes('food') ||
    lower.includes('restaurant') ||
    lower.includes('dining') ||
    lower.includes('eating out') ||
    lower.includes('meal') ||
    lower.includes('cafe') ||
    lower.includes('lunch') ||
    lower.includes('breakfast') ||
    lower.includes('dinner')
  ) {
    return 'food';
  }

  if (lower.includes('transport') || lower.includes('car') || lower.includes('fuel') || lower.includes('transit')) {
    return 'car';
  }

  if (lower.includes('utility') || lower.includes('utilities') || lower.includes('electric') || lower.includes('gas bill')) {
    return 'zap';
  }

  if (lower.includes('internet') || lower.includes('broadband') || lower.includes('wifi')) {
    return 'wifi';
  }

  if (lower.includes('insurance')) {
    return 'shield';
  }

  if (lower.includes('christmas') || lower.includes('holiday gift')) {
    return 'christmas-tree';
  }

  if (lower.includes('gift')) {
    return 'gift';
  }

  if (lower.includes('medicine') || lower.includes('pharmacy') || lower.includes('health')) {
    return 'heart-pulse';
  }

  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('game')) {
    return 'film';
  }

  if (lower.includes('shopping')) {
    return 'shopping-cart';
  }

  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('workout') || lower.includes('sport')) {
    return 'dumbbell';
  }

  if (
    lower.includes('cosmetic') ||
    lower.includes('makeup') ||
    lower.includes('beauty') ||
    lower.includes('skincare') ||
    lower.includes('perfume') ||
    lower.includes('lotion')
  ) {
    return 'spray-can';
  }

  if (
    lower.includes('subscription') ||
    lower.includes('subscribe') ||
    lower.includes('recurring') ||
    lower.includes('membership')
  ) {
    return 'credit-card';
  }

  if (lower === 'other' || lower.includes('misc')) {
    return 'wallet';
  }

  return DEFAULT_CATEGORY_ICON_KEY;
}

// Migration helper for older stored data that used component-style keys
// like "ShoppingBasket" / "ShoppingCart" etc.
export function migrateLegacyIconKey(legacyIcon?: string | null): IconKey {
  switch (legacyIcon) {
    case 'ShoppingBasket':
      return 'shopping-basket';
    case 'ShoppingCart':
      return 'shopping-cart';
    case 'PartyPopper':
      return 'party-popper';
    case 'MoreHorizontal':
      return 'more-horizontal';
    case 'Home':
      return 'home';
    default:
      return DEFAULT_CATEGORY_ICON_KEY;
  }
}

/** @deprecated Use CATEGORY_ICON_SRC — alias for ExpenseForm picker migration. */
export const ICON_MAP = CATEGORY_ICON_SRC;
