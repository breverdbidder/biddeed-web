import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider'
import { source } from '@/lib/source'
import { Disclaimer } from '@/components/academy/Disclaimer'

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
 */
export default function AcademyLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
      <div className="academy-scope">
        <DocsLayout tree={source.pageTree} nav={{ enabled: false }}>
          {children}
          {/* Persistent investor-education disclaimer on every Academy page. */}
          <footer className="mx-auto w-full max-w-[var(--fd-page-width,52rem)] px-6 pb-10">
            <Disclaimer />
          </footer>
        </DocsLayout>
      </div>
    </RootProvider>
  )
}
