/**
 * WCAG 2.4.1 (Bypass Blocks). Rendered first inside <body> (see app/layout.tsx)
 * so it is the first tab stop on every route, before the sidebar/topbar chrome.
 * Visually hidden until focused, then pinned to the top of the viewport.
 * Targets #main, which every route's landmark carries — see AppShell.tsx.
 *
 * Hidden via clip-path, not Tailwind's sr-only (which shrinks the box to
 * 1x1px). clip-path only affects paint, not layout, so the link keeps its
 * full padded footprint — same size focused or not — while staying
 * invisible and out of the way for sighted mouse users at rest. A 1x1 box,
 * though correctly invisible, is a keyboard-only target smaller than any
 * tap-target minimum; nothing needs it that small, since a pointer user
 * can never reach it in the clipped state to begin with.
 */
export default function SkipToContent() {
  return (
    <a
      href="#main"
      className="absolute left-4 top-4 z-[1100] inline-flex min-h-11 items-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground [clip:rect(0,0,0,0)] [clip-path:inset(50%)] focus:[clip:auto] focus:[clip-path:none] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Skip to content
    </a>
  )
}
