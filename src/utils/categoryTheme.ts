export const CATEGORY_PALETTE = [
  { bar: "hsl(278 24% 38%)", bg: "hsl(278 24% 38% / 0.12)" },
  { bar: "hsl(32 42% 58%)", bg: "hsl(32 42% 58% / 0.14)" },
  { bar: "hsl(18 52% 58%)", bg: "hsl(18 52% 58% / 0.14)" },
  { bar: "hsl(152 28% 38%)", bg: "hsl(152 28% 38% / 0.12)" },
  { bar: "hsl(260 8% 58%)", bg: "hsl(260 8% 58% / 0.12)" },
  { bar: "hsl(28 48% 52%)", bg: "hsl(28 48% 52% / 0.14)" },
] as const;

export function getCategoryTheme(index: number) {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}
