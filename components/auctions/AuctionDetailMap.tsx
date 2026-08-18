'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface Props {
  lat: number
  lng: number
  label: string
  type: string
}

function pinColor(type: string): string {
  switch (type) {
    case 'foreclosure': return '#EF4444'
    case 'tax_deed': return '#F59E0B'
    default: return '#6B7280'
  }
}

export default function AuctionDetailMap({ lat, lng, label, type }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!MAPBOX_TOKEN) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [lng, lat],
      zoom: 15,
      interactive: true,
    })

    mapRef.current.on('load', () => {
      mapRef.current?.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      const el = document.createElement('div')
      const color = pinColor(type)
      el.style.cssText = `
        width: 20px; height: 20px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      `

      new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(mapRef.current!)
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-100 dark:bg-slate-800">
        <p className="text-xs text-gray-400">Map unavailable</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-64" />
  )
}
