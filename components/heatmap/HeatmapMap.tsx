'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { apiUrl } from '@/lib/api'
import {
  buildFillColorExpression,
  NO_DATA_FILL,
  COUNTY_LINE,
  COUNTY_SELECTED_LINE,
  PIN_FILL,
  PIN_HALO,
} from '@/lib/heatmap/colorScales'

const STREETS_STYLE = 'mapbox://styles/mapbox/streets-v12'
const FL_CENTER: [number, number] = [-81.6, 27.9]

interface AuctionPin {
  id: string
  latitude: number
  longitude: number
  county: string
  property_address: string | null
  auction_date: string | null
  sale_type: string | null
}

interface CountyGeoFeature {
  type: 'Feature'
  properties: { GEO_ID: string; STATE: string; COUNTY: string; NAME: string; LSAD: string }
  geometry: unknown
}

export interface HeatmapMapProps {
  countyValues: Record<string, number | null>
  colorScale: string[]
  selectedFips: string | null
  onSelectCounty: (fips: string, name: string) => void
  onPinsLoaded?: (count: number, asOf: string) => void
  compact?: boolean
  className?: string
}

/**
 * The map's primary objects remain the live auction pins (issue #75
 * Amendment 1) — the choropleth fill is added first (so it sits underneath),
 * pins are added after with a white halo so they read over any fill color at
 * a glance. Adapted from components/auctions/AuctionMap.tsx's clustering
 * approach; trimmed to what this surface needs (no satellite/zoning toggles).
 */
export default function HeatmapMap({
  countyValues,
  colorScale,
  selectedFips,
  onSelectCounty,
  onPinsLoaded,
  compact,
  className,
}: HeatmapMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [countyGeo, setCountyGeo] = useState<CountyGeoFeature[] | null>(null)
  const [pinsError, setPinsError] = useState<string | null>(null)
  const countyValuesRef = useRef(countyValues)
  const colorScaleRef = useRef(colorScale)
  const selectRef = useRef(onSelectCounty)
  countyValuesRef.current = countyValues
  colorScaleRef.current = colorScale
  selectRef.current = onSelectCounty

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  // County boundaries — fetched once, real US Census TIGER-derived FL county
  // geometry (public/data/heatmap/fl-counties.geojson), not a fabricated shape.
  useEffect(() => {
    fetch('/data/heatmap/fl-counties.geojson')
      .then((r) => r.json())
      .then((geo) => setCountyGeo(geo.features))
      .catch(() => setCountyGeo([]))
  }, [])

  // Live + upcoming auction pins statewide, same endpoint /radar uses.
  useEffect(() => {
    const params = new URLSearchParams({ upcoming: 'true' })
    fetch(apiUrl(`/api/auctions/map?${params}`))
      .then((res) => {
        if (!res.ok) throw new Error(`map request failed (${res.status})`)
        return res.json()
      })
      .then((json: { data: AuctionPin[]; total_matching: number }) => {
        setPinsError(null)
        onPinsLoaded?.(json.total_matching, new Date().toISOString())
        if (mapRef.current && mapLoaded) renderPins(json.data)
      })
      .catch(() => {
        setPinsError('Live auction pins are temporarily unavailable.')
        onPinsLoaded?.(0, new Date().toISOString())
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured')
      return
    }
    mapboxgl.accessToken = MAPBOX_TOKEN
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: STREETS_STYLE,
      center: FL_CENTER,
      zoom: compact ? 5.2 : 5.8,
    })
    mapRef.current.on('load', () => {
      setMapLoaded(true)
      mapRef.current?.addControl(new mapboxgl.NavigationControl(), 'top-right')
    })
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function firstSymbolLayerId(map: any): string | undefined {
    const layers = map.getStyle?.()?.layers ?? []
    return layers.find((l: any) => l.type === 'symbol' && l.layout?.['text-field'])?.id
  }

  const buildChoroplethGeoJSON = useCallback(() => {
    const features = (countyGeo ?? []).map((f) => {
      const fips = f.properties.COUNTY
      const value = countyValuesRef.current[fips] ?? null
      return {
        ...f,
        properties: { ...f.properties, kpi_value: value, fips },
      }
    })
    return { type: 'FeatureCollection' as const, features }
  }, [countyGeo])

  function addChoroplethLayer() {
    const map = mapRef.current
    if (!map || !countyGeo) return
    const beforeId = firstSymbolLayerId(map)

    ;['county-fill', 'county-outline', 'county-selected'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id)
    })
    if (map.getSource('counties')) map.removeSource('counties')

    const geojson = buildChoroplethGeoJSON()
    const values = Object.values(countyValuesRef.current).filter((v): v is number => v != null)
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : 1

    map.addSource('counties', { type: 'geojson', data: geojson })

    map.addLayer(
      {
        id: 'county-fill',
        type: 'fill',
        source: 'counties',
        paint: {
          // <=0.5 opacity (issue #75 B3): pins must read clearly over the fill.
          'fill-color': buildFillColorExpression('kpi_value', min, max, colorScaleRef.current) as any,
          'fill-opacity': 0.5,
        },
      },
      beforeId
    )

    map.addLayer(
      {
        id: 'county-outline',
        type: 'line',
        source: 'counties',
        paint: { 'line-color': COUNTY_LINE, 'line-width': 0.75 },
      },
      beforeId
    )

    map.addLayer(
      {
        id: 'county-selected',
        type: 'line',
        source: 'counties',
        filter: ['==', ['get', 'fips'], selectedFips ?? '__none__'],
        paint: { 'line-color': COUNTY_SELECTED_LINE, 'line-width': 3 },
      },
      beforeId
    )

    map.on('click', 'county-fill', (e: any) => {
      const props = e.features?.[0]?.properties
      if (props) selectRef.current(props.fips, props.NAME)
    })
    map.on('mouseenter', 'county-fill', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'county-fill', () => {
      map.getCanvas().style.cursor = ''
    })
  }

  function renderPins(pins: AuctionPin[]) {
    const map = mapRef.current
    if (!map) return
    const beforeId = firstSymbolLayerId(map)

    ;['auction-clusters', 'auction-cluster-count', 'auction-points'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id)
    })
    if (map.getSource('auction-pins')) map.removeSource('auction-pins')

    const geojson = {
      type: 'FeatureCollection' as const,
      features: pins.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
        properties: { id: p.id },
      })),
    }

    map.addSource('auction-pins', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 45,
    })

    // Topmost layer, always. High-contrast fill + a white halo stroke so the
    // pin reads over green, red, amber, or grey no-data fill alike (issue
    // #75 risk: "pins need a high-contrast outline/halo and must render in a
    // topmost layer"). No beforeId passed here — inserted after every other
    // layer this render pass adds, i.e. on top.
    map.addLayer({
      id: 'auction-clusters',
      type: 'circle',
      source: 'auction-pins',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': PIN_FILL,
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
        'circle-stroke-width': 3,
        'circle-stroke-color': PIN_HALO,
      },
    })

    map.addLayer({
      id: 'auction-cluster-count',
      type: 'symbol',
      source: 'auction-pins',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': PIN_HALO },
    })

    map.addLayer({
      id: 'auction-points',
      type: 'circle',
      source: 'auction-pins',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': PIN_FILL,
        'circle-radius': 6,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': PIN_HALO,
      },
    })

    map.on('click', 'auction-clusters', (e: any) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['auction-clusters'] })
      const clusterId = features[0].properties.cluster_id
      map.getSource('auction-pins').getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return
        map.easeTo({ center: features[0].geometry.coordinates, zoom })
      })
    })
    map.on('mouseenter', 'auction-clusters', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'auction-clusters', () => (map.getCanvas().style.cursor = ''))
    map.on('mouseenter', 'auction-points', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'auction-points', () => (map.getCanvas().style.cursor = ''))
  }

  useEffect(() => {
    if (!mapLoaded || !countyGeo) return
    addChoroplethLayer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, countyGeo, countyValues, colorScale])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current
    if (map.getLayer('county-selected')) {
      map.setFilter('county-selected', ['==', ['get', 'fips'], selectedFips ?? '__none__'])
    }
  }, [selectedFips, mapLoaded])

  if (mapError) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {mapError}
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-border ${className ?? ''}`}>
      <div ref={mapContainer} className="h-full w-full" />
      {pinsError && (
        <div className="absolute left-3 top-3 z-20 rounded-md bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          {pinsError}
        </div>
      )}
      {!compact && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
          <span className="inline-flex size-2.5 rounded-full border-2 border-white" style={{ backgroundColor: PIN_FILL }} />
          Live auction pins
          <span className="text-muted-foreground/60">·</span>
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ backgroundColor: NO_DATA_FILL }}
          />
          No data
        </div>
      )}
    </div>
  )
}
