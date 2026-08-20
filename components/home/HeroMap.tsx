'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { apiUrl } from '@/lib/api'

/**
 * The hero is the product, not a picture of the product.
 *
 * This is the same mapbox-gl renderer and the same /api/auctions/map feed the
 * workspace uses, drawing every upcoming Florida auction the database actually
 * holds. It is deliberately NOT a screenshot: a static image cannot be wrong,
 * which is the problem with it -- if the pipeline stops, this pane must go
 * quiet and say so, and the person who owns the site must see that on the home
 * page rather than in a support ticket.
 *
 * mapbox-gl compiles its renderer into a Blob and spawns it as a worker, which
 * is why middleware.ts carries `blob:` in script-src and worker-src and
 * api.mapbox.com/events.mapbox.com in connect-src. Without those four entries
 * this component paints white at HTTP 200 -- the exact failure the audit found.
 */

interface MapPoint {
  // uuid. GET /api/auctions/map returns
  // "72f48be9-05ee-4abd-a7bd-90fd90e5678f" (verified 2026-08-20); this was
  // declared `number` and nothing disagreed, because the value is only ever
  // used as a Map key and a route segment.
  id: string
  latitude: number
  longitude: number
  sale_type: string | null
  county: string
}

const FL_CENTER: [number, number] = [-82.4, 28.1]
const TYPE_COLOR: Record<string, string> = {
  foreclosure: '#f59e0b',
  tax_deed: '#38bdf8',
}

export default function HeroMap() {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [plotted, setPlotted] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !container.current || mapRef.current) {
      if (!token) setFailed(true)
      return
    }

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: FL_CENTER,
      zoom: 5.6,
      attributionControl: true,
      // Chrome on the hero, not a control panel: the workspace at /radar is
      // where you drive the map. Here it only has to prove the data is real.
      interactive: true,
      cooperativeGestures: true,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    const controller = new AbortController()

    map.on('error', () => setFailed(true))

    map.on('load', async () => {
      try {
        const res = await fetch(apiUrl('/api/auctions/map?upcoming=true'), {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`map endpoint returned ${res.status}`)
        const json = (await res.json()) as { data: MapPoint[] }
        const points = (json.data || []).filter(
          (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
        )
        if (!points.length) {
          setFailed(true)
          return
        }

        map.addSource('auctions', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: points.map((p) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
              properties: { color: TYPE_COLOR[p.sale_type || ''] || '#94a3b8' },
            })),
          },
          cluster: true,
          clusterRadius: 42,
          clusterMaxZoom: 11,
        })

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'auctions',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#f59e0b',
            'circle-opacity': 0.28,
            'circle-radius': ['step', ['get', 'point_count'], 14, 25, 20, 100, 27, 400, 34],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#f59e0b',
          },
        })
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'auctions',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 11,
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#fde68a' },
        })
        map.addLayer({
          id: 'points',
          type: 'circle',
          source: 'auctions',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 4,
            'circle-opacity': 0.9,
            'circle-stroke-width': 0.5,
            'circle-stroke-color': '#020617',
          },
        })

        setPlotted(points.length)
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') setFailed(true)
      }
    })

    return () => {
      controller.abort()
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-xl border border-slate-800 bg-[#0b1220] sm:h-[380px] lg:h-[440px]">
      <div ref={container} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-slate-700/70 bg-[#020617]/85 px-2.5 py-1.5 text-[11px] leading-tight text-slate-300 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-bd-orange" /> Foreclosure
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-sky-400" /> Tax deed
          </span>
        </div>
        <div className="mt-1 text-slate-500">
          {/* Never a placeholder count and never 0 -- an em-dash until the
              endpoint answers, and the endpoint is named so the number is
              checkable. */}
          {failed ? 'Live pins unavailable' : `${plotted == null ? '—' : plotted.toLocaleString('en-US')} pins · /api/auctions/map`}
        </div>
      </div>

      {failed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b1220]/92 px-6 text-center">
          <p className="max-w-xs text-sm text-slate-400">
            The live map is not answering right now. The auction data behind it is unaffected —
            open{' '}
            <a href="/radar" className="text-bd-orange underline">
              the workspace
            </a>{' '}
            to work the list.
          </p>
        </div>
      )}
    </div>
  )
}
