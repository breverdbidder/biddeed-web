'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/lib/theme-context'
import { palette } from '@/lib/design-tokens'
import type { D4DRouteStop } from './types'

interface Props {
  stops: D4DRouteStop[]
  originLat?: number | null
  originLng?: number | null
  activeStopId?: string | null
}

const STYLE = 'mapbox://styles/mapbox/streets-v12'

export default function D4DMap({ stops, originLat, originLng, activeStopId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const { theme } = useTheme()
  const C = palette(theme)

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured')
      return
    }
    mapboxgl.accessToken = MAPBOX_TOKEN
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [-81.5, 27.6],
      zoom: 6,
    })
    mapRef.current.on('load', () => setMapLoaded(true))
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw numbered markers + the ordered route line whenever stops or the
  // active (drive-mode) stop changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const coords: [number, number][] = []
    if (originLat != null && originLng != null) coords.push([originLng, originLat])

    for (const stop of stops) {
      coords.push([stop.longitude, stop.latitude])
      const isActive = stop.id === activeStopId
      const el = document.createElement('div')
      el.style.width = isActive ? '30px' : '24px'
      el.style.height = isActive ? '30px' : '24px'
      el.style.borderRadius = '9999px'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.fontSize = '12px'
      el.style.fontWeight = '700'
      el.style.fontFamily = 'system-ui, sans-serif'
      el.style.color = C.background
      el.style.background = isActive ? C.brandHover : C.brand
      el.style.border = `2px solid ${C.background}`
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,.35)'
      el.textContent = String(stop.seq)

      const popup = new mapboxgl.Popup({ offset: 14, maxWidth: '260px' }).setHTML(
        `<div style="font-family:system-ui;font-size:12px;">` +
          `<p style="font-weight:600;margin:0 0 4px 0;">${stop.property_address ?? 'Unknown address'}</p>` +
          (stop.judgment_amount ? `<p style="margin:0 0 2px 0;">Judgment: $${Math.round(stop.judgment_amount).toLocaleString()}</p>` : '') +
          (stop.signal_max_bid ? `<p style="margin:0;">SIGNAL$ Max Bid: $${Math.round(stop.signal_max_bid).toLocaleString()}</p>` : '') +
          `</div>`
      )

      const marker = new mapboxgl.Marker({ element: el }).setLngLat([stop.longitude, stop.latitude]).setPopup(popup).addTo(map)
      markersRef.current.push(marker)
    }

    if (originLat != null && originLng != null) {
      const el = document.createElement('div')
      el.style.width = '18px'
      el.style.height = '18px'
      el.style.borderRadius = '9999px'
      el.style.background = C.navy
      el.style.border = `2px solid ${C.background}`
      markersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([originLng, originLat]).addTo(map))
    }

    const lineData: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }

    const applyLine = () => {
      if (map.getSource('d4d-route-line')) {
        ;(map.getSource('d4d-route-line') as mapboxgl.GeoJSONSource).setData(lineData)
      } else if (coords.length > 1) {
        map.addSource('d4d-route-line', { type: 'geojson', data: lineData })
        map.addLayer({
          id: 'd4d-route-line',
          type: 'line',
          source: 'd4d-route-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': C.brand, 'line-width': 3, 'line-dasharray': [1, 1.4] },
        })
      }
    }
    if (map.isStyleLoaded()) applyLine()
    else map.once('idle', applyLine)

    if (coords.length > 1) {
      const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]))
      map.fitBounds(bounds, { padding: 60, maxZoom: 13 })
    } else if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: 12 })
    }
  }, [stops, originLat, originLng, activeStopId, mapLoaded, C])

  // Follow the active drive-mode stop.
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !activeStopId) return
    const stop = stops.find((s) => s.id === activeStopId)
    if (!stop) return
    mapRef.current.flyTo({ center: [stop.longitude, stop.latitude], zoom: 15, duration: 700 })
  }, [activeStopId, stops, mapLoaded])

  if (mapError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {mapError}
      </div>
    )
  }

  return <div ref={containerRef} className="h-full min-h-[360px] w-full rounded-lg border border-border" />
}
