'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'
import DeedPanel from './DeedPanel'
import Topbar from './Topbar'
import StickyDeedCta from './StickyDeedCta'

/**
 * The application shell: persistent nav rail + topbar wrapping every route.
 *
 * State lives in React and nowhere else. No localStorage, no sessionStorage,
 * and the upstream shadcn sidebar cookie has been removed (see the note in
 * components/ui/sidebar.tsx). A reload starts expanded on desktop, collapsed
 * into a Sheet under 768px; that is the intended behaviour, not a gap.
 *
 * The nav reads useSearchParams (it has to distinguish /radar from
 * /radar?view=calendar). That is deliberately NOT wrapped in Suspense: a
 * Suspense boundary here hydrates after its parent, so SidebarProvider's
 * useIsMobile() effect fires first and flips the desktop/Sheet branch before
 * the boundary hydrates -- a guaranteed hydration mismatch at <768px
 * (measured: React #418 on every mobile route). Instead app/layout.tsx is
 * force-dynamic, so nothing prerenders and useSearchParams needs no boundary.
 *
 * Deed has ONE home. On '/' the page itself is the conversation, so the side
 * panel and the floating "Talk to Deed" card are not mounted there — three
 * doors into the same room read as clutter, and the customer already has the
 * room. Every other route keeps the panel as a companion to the workspace.
 */
export default function AppShell({
  children,
  authEnabled = false,
}: {
  children: React.ReactNode
  authEnabled?: boolean
}) {
  const pathname = usePathname()
  const isHome = pathname === '/'
  // Measured live at 390x844 (#20060): the fixed "Talk to Deed" card covered the
  // composer Send button while Deed was open, and the Continue button / sign-in
  // link on the Clerk forms. Once Deed is open the panel has its own close
  // button and the Topbar has the toggle, so the card is redundant there; on
  // the auth routes it must never sit over the form.
  const isAuthRoute = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')
  const [deedOpen, setDeedOpen] = useState(false)
  const toggleDeed = () => setDeedOpen((v) => !v)

  // Authentication pages own their centered layout. Mounting the application
  // shell around them creates a second navigation system and puts fixed Deed
  // surfaces over Clerk controls, especially at 390px. Keep the route boundary
  // explicit so auth styling remains independent of workspace navigation.
  if (isAuthRoute) {
    return (
      <main id="main" className="min-h-screen bg-background text-foreground">
        {children}
      </main>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar deedOpen={deedOpen && !isHome} onToggleDeed={toggleDeed} authEnabled={authEnabled} showDeedToggle={!isHome} />

      {/*
        SidebarInset renders the <main> landmark. The content wrapper below is a
        plain div on purpose: two nested <main> elements is an accessibility
        error (one landmark per page), and screen readers announced both.
      */}
      <SidebarInset id="main" className="min-w-0 bg-background text-foreground">
        <Topbar deedOpen={deedOpen && !isHome} onToggleDeed={toggleDeed} showDeedToggle={!isHome} />

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
          {!isHome ? (
            <>
              <DeedPanel open={deedOpen} onClose={() => setDeedOpen(false)} />
              {!deedOpen && !isAuthRoute ? <StickyDeedCta open={deedOpen} onToggle={toggleDeed} /> : null}
            </>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
