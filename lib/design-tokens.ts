/**
 * JS mirror of the colour tokens in app/globals.css (:root / html[data-theme]).
 *
 * This is the ONLY file besides app/globals.css that may carry a colour literal
 * (PARITY_PRD.md §4 change control; scripts/palette-gate.mjs enforces it). It exists
 * because a few third-party surfaces (Clerk's appearance API) need real colour
 * strings and cannot read CSS variables. Everything rendered by this app uses the
 * Tailwind token classes (bg-background, text-foreground, text-muted-foreground,
 * bg-primary, border-border, bg-secondary …), never these values.
 *
 * Light palette = Ariel, 2026-09-04 evening (PR #44): brand blue, navy, tint,
 * ink, border — plus white. No other colours.
 */
export const LIGHT = {
  background: '#F5F0E8',
  card: '#FBFAF7',
  tint: '#F8D4C5',
  ink: '#1F1B16',
  navy: '#1F1B16',
  border: '#DDD5C9',
  brand: '#8F4028',
  brandHover: '#7A3424',
} as const

/** Dark palette = same family lifted for contrast on a navy-black ground. */
export const DARK = {
  background: '#0B1119',
  card: '#111B27',
  tint: '#1B2737',
  ink: '#EDEDED',
  navy: '#9EB2C7',
  border: '#24344C',
  brand: '#1A90FF',
  brandHover: '#4DA6FF',
} as const

export type Palette = typeof LIGHT | typeof DARK

export function palette(theme: 'light' | 'dark'): Palette {
  return theme === 'dark' ? DARK : LIGHT
}
