'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { DeedAuthProvider } from '@/lib/deed/deedAuth'
import AppSidebar from './AppSidebar'
import ChatContainmentGuard from './ChatContainmentGuard'
import CommandPalette from './CommandPalette'
import DeedPanel from './DeedPanel'
import Topbar from './Topbar'
import StickyDeedCta from './StickyDeedCta'

/**
 * The application shell: persistent nav rail + topbar wrapping every route.
 *
 * The desktop rail's expanded/collapsed choice is remembered per device
 * (PARITY CP-2 §2, "collapsible, remembered"): read from localStorage after
 * mount inside try/catch — the server always renders expanded, so there is no
 * hydration mismatch, and a blocked store simply means "expanded" every
 * visit. No cookie: the upstream shadcn sidebar cookie was removed on
 * purpose (see the note in components/ui/sidebar.tsx). Under 768px the nav is
 * a Sheet and this state is not consulted.
 *
 * The nav reads useSearchParams (it has to distinguish /radar from
 * /radar?view=calendar). That is deliberately NOT wrapped in Suspense: a
 * Suspense boundary here hydrates after its parent, so SidebarProvider's
 * useIsMobile() effect fires first and flips the desktop/Sheet branch before
 * the boundary hydrates -- a guaranteed hydration mismatch at <768px
 * (measured: React error 418 on every mobile route). Instead app/layout.tsx is
 * force-dynamic, so nothing prerenders and useSearchParams needs no boundary.
 *
 * Deed has ONE home. On '/' and on '/chat' the page itself is the
 * conversation, so the side panel and the floating "Talk to Deed" card are not
 * mounted there — three doors into the same room read as clutter, and the
 * customer already has the room. Every other route keeps the panel as a
 * companion to the workspace.
 */
const SIDEBAR_KEY = 'biddeed.shell.sidebar.v1'

export default function AppShell({
  children,
  authEnabled = false,
}: {
  children: React.ReactNode
  authEnabled?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  // '/' and '/chat' ARE the conversation (PARITY CP-2); the Deed side panel
  // and floating card stay off them. `isHome` keeps its name for the diff.
  const isHome = pathname === '/' || pathname === '/chat'
  const [sidebarOpen, setSidebarOpen] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === 'collapsed') setSidebarOpen(false)
    } catch {
      /* storage unavailable — stays expanded */
    }
  }, [])
  const onSidebarOpenChange = useCallback((open: boolean) => {
    setSidebarOpen(open)
    try {
      // Only a desktop choice is a preference. The 640–1023px band collapses
      // the rail by itself (components/ui/sidebar.tsx) and must not be
      // recorded as "the customer wants it collapsed".
      if (window.matchMedia('(min-width: 1024px)').matches) {
        localStorage.setItem(SIDEBAR_KEY, open ? 'expanded' : 'collapsed')
      }
    } catch {
      /* storage unavailable — the choice lasts for this page only */
    }
  }, [])
  // Measured live at 390x844 (#20060): the fixed "Talk to Deed" card covered the
  // composer Send button while Deed was open, and the Continue button / sign-in
  // link on the Clerk forms. Once Deed is open the panel has its own close
  // button and the Topbar has the toggle, so the card is redundant there; on
  // the auth routes it must never sit over the form.
  const isAuthRoute = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')
  // Pages that carry their own inline Deed entry point (the "Ask Deed first"
  // button on /support) don't need the floating "Talk to Deed" card as well;
  // measured live, the fixed card covered the contact email lines at the
  // bottom of /support at 1280px. Ariel call 2026-09-09: hide it there.
  // /maps (#75): same collision, measured live at 390x844 — the fixed card
  // sits directly over the scorecard bottom sheet's peek row and toggle.
  // /academy: Fumadocs renders previous/next navigation at the page's bottom
  // edge. At 390px the 56px launcher overlaps the Next card's lower-right
  // hit area, so Academy uses the persistent Topbar Ask Deed entry instead.
  const hasOwnDeedEntry = pathname.startsWith('/support') || pathname.startsWith('/maps') || pathname.startsWith('/academy')
  const [deedOpen, setDeedOpen] = useState(false)
  const toggleDeed = () => setDeedOpen((v) => !v)

  // Authentication pages own their centered layout. Mounting the application
  // shell around them creates a second navigation system and puts fixed Deed
  // surfaces over Clerk controls, especially at 390px. Keep the route boundary
  // explicit so auth styling remains independent of workspace navigation.
  if (isAuthRoute) {
    return (
      <main id="main" tabIndex={-1} className="min-h-screen bg-background text-foreground focus:outline-none">
        <ChatContainmentGuard authEnabled={authEnabled} />
        {children}
      </main>
    )
  }

  return (
    <DeedAuthProvider authEnabled={authEnabled}>
    <SidebarProvider open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
      <ChatContainmentGuard authEnabled={authEnabled} />
      {/* ⌘K / Ctrl+K from any page in the shell (PARITY CP-9). */}
      <CommandPalette />
      <AppSidebar deedOpen={deedOpen && !isHome} onToggleDeed={toggleDeed} authEnabled={authEnabled} showDeedToggle={!isHome} />

      {/*
        SidebarInset renders the <main> landmark. The content wrapper below is a
        plain div on purpose: two nested <main> elements is an accessibility
        error (one landmark per page), and screen readers announced both.
        tabIndex -1 is the skip link's landing: without it, "Skip to content"
        left focus on <body> on a hydrated page (PARITY CP-9 keyboard
        walkthrough, 2026-09-23). Focusable by script and fragment only, never
        a Tab stop.
      */}
      <SidebarInset id="main" tabIndex={-1} className="min-w-0 bg-background text-foreground focus:outline-none">
        <Topbar deedOpen={deedOpen && !isHome} onToggleDeed={toggleDeed} showDeedToggle={!isHome} />

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
          {!isHome ? (
            <>
              <DeedPanel open={deedOpen} onClose={() => setDeedOpen(false)} />
              {!deedOpen && !hasOwnDeedEntry ? <StickyDeedCta open={deedOpen} onToggle={toggleDeed} /> : null}
            </>
          ) : null}
          {/*
            Owner call 2026-09-19: the bottom-right Talk-to-Deed launcher
            belongs on the landing page too - the CP-4 shell dropped it there
            ("disappeared", Samsung/Chrome) and both doors are wanted back:
            this floating button AND the sidebar's "Ask Deed here". The side
            panel itself still stays off '/', so the launcher routes to the
            full chat instead of toggling a panel that is not mounted. '/chat'
            keeps neither launcher nor panel - the customer is already in the
            room.
          */}
          {pathname === '/' ? (
            <StickyDeedCta open={false} onToggle={() => router.push('/chat')} panelId={null} />
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </DeedAuthProvider>
  )
}
