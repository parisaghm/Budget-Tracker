/**
 * Shared IconKey → local OpenMoji SVG path map.
 * Assets live under public/icons/openmoji/ (no CDN hotlinking).
 */
export const CATEGORY_ICON_SRC = {
  home: '/icons/openmoji/house.svg',
  shirt: '/icons/openmoji/t-shirt.svg',
  dumbbell: '/icons/openmoji/flexed-biceps.svg',
  'credit-card': '/icons/openmoji/credit-card.svg',
  'shopping-cart': '/icons/openmoji/shopping-cart.svg',
  'shopping-basket': '/icons/openmoji/basket.svg',
  food: '/icons/openmoji/fork-and-knife.svg',
  car: '/icons/openmoji/automobile.svg',
  film: '/icons/openmoji/clapper-board.svg',
  'heart-pulse': '/icons/openmoji/medical-symbol.svg',
  tag: '/icons/openmoji/label.svg',
  'spray-can': '/icons/openmoji/lotion-bottle.svg',
  'party-popper': '/icons/openmoji/party-popper.svg',
  'more-horizontal': '/icons/openmoji/speech-balloon.svg',
  baby: '/icons/openmoji/baby.svg',
  zap: '/icons/openmoji/high-voltage.svg',
  wifi: '/icons/openmoji/antenna-bars.svg',
  shield: '/icons/openmoji/shield.svg',
  gift: '/icons/openmoji/wrapped-gift.svg',
  wallet: '/icons/openmoji/wallet.svg',
  briefcase: '/icons/openmoji/briefcase.svg',
  laptop: '/icons/openmoji/laptop.svg',
  'christmas-tree': '/icons/openmoji/christmas-tree.svg',
} as const;

export type IconKey = keyof typeof CATEGORY_ICON_SRC;

/** Fallback when no category mapping or label inference matches. */
export const DEFAULT_CATEGORY_ICON_KEY: IconKey = 'wallet';

const DEFAULT_SRC = CATEGORY_ICON_SRC[DEFAULT_CATEGORY_ICON_KEY];

/** Resolve an IconKey (or unknown string) to a local OpenMoji SVG URL. */
export function getCategoryIconSrc(iconKey?: string | null): string {
  if (iconKey && iconKey in CATEGORY_ICON_SRC) {
    return CATEGORY_ICON_SRC[iconKey as IconKey];
  }
  return DEFAULT_SRC;
}

/** Stable list of icon keys for pickers (excludes aliases not in the picker set). */
export const ICON_KEYS = Object.keys(CATEGORY_ICON_SRC) as IconKey[];
