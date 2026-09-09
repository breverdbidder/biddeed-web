import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider'
import { source } from '@/lib/source'
import { MobileAcademyNav } from '@/components/academy/MobileAcademyNav'

import 'fumadocs-ui/style.css'
import './academy.css'

/**
 * BidDeed Academy (#63) — Fumadocs mounted under /academy.
 *
 * This layout renders INSIDE AppShell (app/layout.tsx wraps every route), so
 * the workspace rail and Topbar stay put and the Fumadocs nav bar is disabled
 * — two navigation systems on one page is the mistake AppShell exists to
 * prevent. The docs sidebar (page tree) is the second-level nav.
 *
 * RootProvider: theme is disabled because the site forces its own light
 * palette (app/layout.tsx) and next-themes would inject an inline script
 * with no CSP nonce — refused by script-src 'strict-dynamic'. Search is
 * disabled for the first PR (no /api/search endpoint mounted yet).
 *
 * No layout-level disclaimer footer: rendered inside DocsLayout it becomes
 * a GRID ITEM and paints as a third column (208px wide, full height) at
 * every viewport — the crushed right panel in the 2026-09-09 mobile bug
 * report. Every lesson page carries the same <Disclaimer /> inline at the
 * end of its MDX instead.
 */
export default function AcademyLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
      <div className="academy-scope">
        {/* Below md the docs sidebar has no trigger (the Fumadocs nav bar is
            disabled), so the page tree gets its own disclosure. It must live
            OUTSIDE DocsLayout: children of DocsLayout are GRID ITEMS, so
            inside it the nav paints as a narrow first column and crushes the
            article to ~265px at 390px (measured live after the first
            version shipped inside, 2026-09-09). */}
        <MobileAcademyNav />
        <DocsLayout tree={source.pageTree} nav={{ enabled: false }}>
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  )
}
