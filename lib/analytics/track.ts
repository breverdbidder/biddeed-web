'use client'

import { apiUrl } from '@/lib/api'
import type { FunnelEventName } from '@/lib/heatmap/config'

const SESSION_KEY = 'bd_heatmap_session_id'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

export interface TrackHeatmapEventOptions {
  surface?: 'homepage' | 'maps'
  geography_level?: 'county' | 'zip'
  geography_id?: string
  kpi_layer?: string
  source?: string
  metadata?: Record<string, unknown>
}

/**
 * Fire-and-forget funnel event. Never awaited by callers and never throws —
 * a tracking call must not be able to block or break map interaction.
 * navigator.sendBeacon would not survive a same-tab client-side route change
 * to /maps carrying a POST body reliably across browsers, so this uses
 * fetch(..., { keepalive: true }) instead, which does.
 */
export function trackHeatmapEvent(name: FunnelEventName, opts: TrackHeatmapEventOptions = {}): void {
  if (typeof window === 'undefined') return
  try {
    fetch(apiUrl('/api/analytics/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event_name: name,
        session_id: getSessionId(),
        ...opts,
      }),
    }).catch(() => {})
  } catch {
    // Analytics must never break the UI it is instrumenting.
  }
}
