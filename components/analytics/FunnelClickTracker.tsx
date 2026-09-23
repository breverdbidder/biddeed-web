'use client'

import { useEffect } from 'react'
import { SAMPLE_REPORT_PATH, track } from '@/lib/analytics/funnel'

/**
 * One delegated click listener for report opens anywhere in the app (issue
 * #181). Report pages are rendered by the Worker, not this app, so the open is
 * measured at the link: any click on /report/<id> fires report_viewed -
 * report_type 'sample' for the public sample, 'paid' for any other report.
 * Only the report type and the page it was opened from are sent, never the
 * link itself (a paid link can carry its access key).
 */
export default function FunnelClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      // The popup fires its own report_viewed with surface=free_report_popup.
      if (a.closest('[role="dialog"]')) return
      let url: URL
      try {
        url = new URL(a.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin || !/^\/report\/[^/]+$/.test(url.pathname)) return
      track(
        'report_viewed',
        { report_type: url.pathname === SAMPLE_REPORT_PATH ? 'sample' : 'paid', surface: 'link' },
        { beacon: true }
      )
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
