import type { LucideIcon } from 'lucide-react';
import {
  ShoppingBasket,
  ShoppingCart,
  PartyPopper,
  MoreHorizontal,
  Home,
  Tag,
  Shirt,
  Car,
  Film,
  HeartPulse,
  Dumbbell,
  CreditCard,
} from 'lucide-react';

export const ICON_MAP = {
  home: Home,
  shirt: Shirt,
  dumbbell: Dumbbell,
  'credit-card': CreditCard,
  'shopping-cart': ShoppingCart,
  'shopping-basket': ShoppingBasket,
  car: Car,
  film: Film,
  'heart-pulse': HeartPulse,
  tag: Tag,
  // Extra keys for existing defaults
  'party-popper': PartyPopper,
  'more-horizontal': MoreHorizontal,
} as const;

export type IconKey = keyof typeof ICON_MAP;

export const DEFAULT_CATEGORY_ICON_KEY: IconKey = 'tag';

export function getCategoryIcon(iconKey?: string | null): LucideIcon {
  if (iconKey && iconKey in ICON_MAP) {
    return ICON_MAP[iconKey as IconKey];
  }
  return ICON_MAP[DEFAULT_CATEGORY_ICON_KEY];
}

export function inferIconKeyFromLabel(label: string): IconKey {
  const lower = label.toLowerCase();

  if (lower.includes('clothes') || lower.includes('clothing') || lower.includes('fashion')) {
    return 'shirt';
  }

  if (lower.includes('rent') || lower.includes('home') || lower.includes('house')) {
    return 'home';
  }

  if (lower.includes('food') || lower.includes('grocery') || lower.includes('groceries')) {
    return 'shopping-basket';
  }

  if (lower.includes('transport') || lower.includes('car') || lower.includes('fuel')) {
    return 'car';
  }

  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('game')) {
    return 'film';
  }

  if (lower.includes('shopping')) {
    return 'shopping-cart';
  }

  if (lower.includes('health') || lower.includes('doctor')) {
    return 'heart-pulse';
  }

  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('workout') || lower.includes('sport')) {
    return 'dumbbell';
  }

  if (lower.includes('subscription') || lower.includes('subscribe') || lower.includes('recurring') || lower.includes('membership')) {
    return 'credit-card';
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


