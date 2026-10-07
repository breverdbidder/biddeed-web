/**
 * The command palette's open event, in its own module so a caller that only
 * dispatches it (the sidebar's Search row) does not pull the whole palette -
 * Radix Dialog, the place and skill lists, the thread search - into the
 * first-load bundle. The palette itself is mounted lazily by
 * LazyCommandPalette (PageSpeed pass, 2026-10-07).
 */
export const OPEN_COMMAND_PALETTE = 'biddeed:command-palette'

/** ⌘K on macOS, Ctrl+K elsewhere - the palette's keyboard shortcut. */
export function isCommandPaletteShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k'
}
