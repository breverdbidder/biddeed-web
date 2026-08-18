'use client'

import { useState } from 'react'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'
import DeedPanel from './DeedPanel'
import Topbar from './Topbar'

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
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [deedOpen, setDeedOpen] = useState(false)
  const toggleDeed = () => setDeedOpen((v) => !v)

  return (
    <SidebarProvider>
      <AppSidebar deedOpen={deedOpen} onToggleDeed={toggleDeed} />

      <SidebarInset className="min-w-0 bg-[#020617]">
        <Topbar deedOpen={deedOpen} onToggleDeed={toggleDeed} />

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
          <DeedPanel open={deedOpen} onClose={() => setDeedOpen(false)} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
