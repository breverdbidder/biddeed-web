/**
 * WCAG 2.4.1 (Bypass Blocks). Rendered first inside <body> (see app/layout.tsx)
 * so it is the first tab stop on every route, before the sidebar/topbar chrome.
 * Visually hidden until focused, then pinned to the top of the viewport.
 * Targets #main, which every route's landmark carries — see AppShell.tsx.
 */
export default function SkipToContent() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Skip to content
    </a>
  )
}
