'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { D4DRouteDetail } from './types'

const D4DMap = dynamic(() => import('./D4DMap'), { ssr: false })

function formatMoney(value: number | null): string {
  if (value == null) return '—'
  return `$${Math.round(value).toLocaleString()}`
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function D4DRouteTab({ detail, loading }: { detail: D4DRouteDetail; loading: boolean }) {
  const { route, stops } = detail

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{route.name}</p>
          <p className="text-xs text-muted-foreground">
            {stops.length} stops · {route.total_distance_miles.toLocaleString()} mi · {formatMinutes(route.estimated_minutes)} drive
          </p>
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[480px]">
          <D4DMap stops={stops} originLat={route.origin_lat} originLng={route.origin_lng} />
        </div>

        <ol className="max-h-[480px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {stops.map((stop) => (
            <li key={stop.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {stop.seq}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{stop.property_address ?? `Case ${stop.case_number}`}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
                  {stop.leg_miles != null && <span>+{stop.leg_miles} mi leg</span>}
                  <span>Judgment {formatMoney(stop.judgment_amount)}</span>
                  {stop.signal_max_bid != null && <span className="text-primary">SIGNAL$ Max Bid {formatMoney(stop.signal_max_bid)}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
