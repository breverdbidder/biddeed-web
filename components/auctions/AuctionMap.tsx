'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTheme } from '@/lib/theme-context'
import { getRecommendation } from '@/lib/scoring'
import { ZONING_CATEGORY_COLORS, type ZoningCategory } from '@/lib/zoning'
import type { Auction } from '@/types/auctions'
import { apiUrl } from '@/lib/api'

/**
 * AuctionRadar map.
 *
 * Previously this rendered whatever page of rows the browse table's fetch
 * happened to hold: at most 200 of 2,709 upcoming auctions, unfiltered by
 * whatever county/type/day the user had actually selected, and with no
 * indication 2,509+ pins were missing. It now owns its own fetch against
 * /api/auctions/map, follows the same county/saleType/dayFilter the rest of
 * the page uses, and renders an honest "showing N of M" banner instead of a
 * cluster count that implies completeness it doesn't have.
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
  property_address: string | null
  auction_date: string | null
  opening_bid: number | null
  assessed_value: number | null
  market_value: number | null
}

interface MapResponse {
  data: MapPoint[]
  returned: number
  total_mappable: number
  total_matching: number
}

interface DayFilter {
  date: string
  saleType?: string
}

interface Props {
  county?: string
  saleType?: string
  dayFilter?: DayFilter | null
  onSelectAuction: (auction: Auction) => void
  /**
   * Split view: coordinates of the row the user just picked in the sidebar.
   * The map flies to it so the list and the map always describe the same
   * property. Null leaves the viewport alone.
   */
  focusPoint?: { lat: number; lng: number } | null
  /** Fill the parent instead of using the standalone fixed height. */
  fillParent?: boolean
}

type ColorMode = 'type' | 'zoning'

function formatCurrency(val: number | null): string {
  if (val == null) return '—'
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// A lean map pin does not carry the full Auction shape (no plaintiff, no
// living area, no zoning). Filling the rest with null keeps the shared detail
// modal working off a click while staying honest about what this row does
// not know - the same convention app/api/auctions/route.ts already uses for
// columns that don't exist on multi_county_auctions.
function toAuctionShape(p: MapPoint): Auction {
  return {
    id: p.id,
    county: p.county,
    case_number: '',
    property_address: p.property_address,
    auction_type: p.sale_type || '',
    auction_date: p.auction_date,
    plaintiff: null,
    assessed_value: p.assessed_value,
    market_value: p.market_value,
    opening_bid: p.opening_bid,
    parcel_id: null,
    source_url: null,
    scraped_at: null,
    created_at: null,
    land_value: null,
    year_built: null,
    owner_name: null,
    photo_url: null,
    enriched_at: null,
    // Unknown, not false — the lean map feed carries no property_type to
    // classify from, and rendering "No" here would assert a fact we don't
    // have (same rule the browse endpoint's mapRow() already follows).
    is_vacant_land: null,
    address_status: null,
    dor_use_code: null,
    zone_code: null,
    municipality: null,
    sale_type: p.sale_type,
    latitude: p.latitude,
    longitude: p.longitude,
  }
}

const STREETS_STYLE = 'mapbox://styles/mapbox/streets-v12'
const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'

export default function AuctionMap({ county, saleType, dayFilter, onSelectAuction, focusPoint, fillParent }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSatellite, setIsSatellite] = useState(true)
  const [colorMode, setColorMode] = useState<ColorMode>('type')
  // Keyed by the auction uuid, not a numeric id. It worked at runtime only
  // because JS Map keys are compared by value and both sides happened to be
  // the same string; the declared key type was simply wrong.
  const pointLookup = useRef<Map<string, MapPoint>>(new Map())
  const { theme } = useTheme()

  const [resp, setResp] = useState<MapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const requestId = useRef(0)

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  const toggleStyle = useCallback(() => {
    setIsSatellite((prev) => !prev)
  }, [])

  // Fetch the filtered, coordinate-only pin set. Runs on every county /
  // saleType / dayFilter change - same filters the calendar and table use, so
  // "Aug 20 tax deeds" means the same set of rows everywhere on this page.
  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    setFetchError(null)
    const params = new URLSearchParams()
    if (county) params.set('county', county)
    if (saleType) params.set('sale_type', saleType)
    if (dayFilter) {
      params.set('from', dayFilter.date)
      params.set('to', dayFilter.date)
      if (dayFilter.saleType) params.set('sale_type', dayFilter.saleType)
    } else {
      params.set('upcoming', 'true')
    }

    fetch(apiUrl(`/api/auctions/map?${params}`))
      .then((res) => {
        if (!res.ok) throw new Error(`map request failed (${res.status})`)
        return res.json()
      })
      .then((json: MapResponse) => {
        if (id !== requestId.current) return
        setResp(json)
      })
      .catch((err) => {
        if (id !== requestId.current) return
        console.error('Failed to fetch map pins:', err)
        setFetchError('Could not load auction pins for this view.')
        setResp(null)
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
  }, [county, saleType, dayFilter?.date, dayFilter?.saleType])

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isFullscreen])

  // Lock body scroll in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isFullscreen])

  // Resize map when fullscreen changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      setTimeout(() => mapRef.current?.resize(), 50)
    }
  }, [isFullscreen, mapLoaded])

  // Initialize map
  // In the split view the map's height comes from a CSS grid track, which can
  // resolve after mapbox-gl has already measured the container - and a map that
  // measured zero height keeps a zero-size canvas until something tells it to
  // look again. Defensive only: when this was added the canvas already measured
  // correctly at 834x584, so it is guarding a plausible race, not a confirmed
  // bug.
  useEffect(() => {
    if (!mapContainer.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    ro.observe(mapContainer.current)
    return () => ro.disconnect()
  }, [mapLoaded])

  // Split view: follow the row the user picked in the sidebar. Zoom is only
  // raised, never lowered, so repeatedly clicking rows pans between properties
  // instead of yo-yoing the whole state in and out on every click.
  useEffect(() => {
    if (!focusPoint || !mapRef.current || !mapLoaded) return
    mapRef.current.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: Math.max(mapRef.current.getZoom?.() ?? 0, 14),
      duration: 900,
    })
  }, [focusPoint, mapLoaded])

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured')
      return
    }

    mapboxgl.accessToken = MAPBOX_TOKEN

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: isSatellite ? SATELLITE_STYLE : STREETS_STYLE,
      center: [-81.5, 27.6],
      zoom: 6,
    })

    mapRef.current.on('load', () => {
      setMapLoaded(true)
      mapRef.current?.addControl(new mapboxgl.NavigationControl(), 'top-right')
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Update style on toggle
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    const style = isSatellite ? SATELLITE_STYLE : STREETS_STYLE
    mapRef.current.setStyle(style)

    mapRef.current.once('style.load', () => {
      addClusterLayers()
    })
  }, [isSatellite])

  function getPointColor(point: MapPoint): string {
    // Zoning data has no source on the lean map feed (no dor_use_code, no
    // zoning_category on multi_county_auctions) - grey/unknown is honest,
    // inventing a category is not.
    if (colorMode === 'zoning') return '#6B7280'
    if (point.sale_type === 'foreclosure') return '#0073CF'
    if (point.sale_type === 'tax_deed') return '#222222'
    return '#6B7280'
  }

  function buildGeoJSON() {
    const points = resp?.data || []
    const features = points.map((p) => {
      const justValue = p.market_value ?? p.assessed_value
      const score = getRecommendation(justValue, p.opening_bid)
      pointLookup.current.set(p.id, p)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [p.longitude, p.latitude],
        },
        properties: {
          id: p.id,
          address: p.property_address || 'No address',
          county: p.county,
          sale_type: p.sale_type,
          just_value: justValue,
          opening_bid: p.opening_bid,
          auction_date: p.auction_date,
          recommendation: score.recommendation,
          rec_color: score.color,
          type_code: p.sale_type === 'foreclosure' ? 0 : p.sale_type === 'tax_deed' ? 1 : 2,
        },
      }
    })

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }

  function getUnclusteredPaint(): any {
    if (colorMode === 'zoning') {
      return {
        'circle-color': '#6B7280',
        'circle-radius': 7,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      }
    }
    return {
      'circle-color': [
        'match',
        ['get', 'type_code'],
        0, '#0073CF',
        1, '#222222',
        '#6B7280',
      ],
      'circle-radius': 7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    }
  }

  /**
   * Id of the first basemap symbol layer, so the auction layers can be
   * inserted BENEATH the place labels.
   *
   * MEASURED 2026-08-20 at 1440x900: the 115 cluster covered the "W" of "West
   * Palm Beach" and the 57 cluster covered "Miami", rendering them as
   * "...est Palm Beach" and "...ami". A bidder orients by city name; a pin
   * that erases the city is worse than no pin. Resolved at runtime, never
   * hardcoded - Mapbox renames these ids between style versions, and a stale
   * id fails silently by putting the layer back on top.
   */
  function firstSymbolLayerId(map: any): string | undefined {
    const layers = map.getStyle?.()?.layers ?? []
    return layers.find((l: any) => l.type === 'symbol' && l.layout?.['text-field'])?.id
  }

  function addClusterLayers() {
    const map = mapRef.current
    if (!map) return
    const beforeId = firstSymbolLayerId(map)

    const layersToRemove = ['clusters', 'cluster-count', 'unclustered-point']
    layersToRemove.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id)
    })
    if (map.getSource('auctions')) map.removeSource('auctions')

    const geojson = buildGeoJSON()

    map.addSource('auctions', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    })

    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'auctions',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          // Cluster buckets are BLUE, never the red/amber that encode sale
          // type. Until 2026-08-20 both scales shared one palette: a red
          // circle meant "Foreclosure" as a pin and "50+ auctions" as a
          // cluster on the same map, and the legend documented that collision
          // rather than resolving it. Blue is colourblind-safe against the
          // red/amber pair and reads on the satellite basemap.
          '#60A5FA',
          10, '#2563EB',
          50, '#1E40AF',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,
          10, 24,
          50, 32,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    }, beforeId)

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'auctions',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        // Bold, not Medium. MEASURED 2026-08-20 on the production render:
        // 12px Medium over a saturated fill left almost every stroke pixel as
        // partial coverage, so the declared #ffffff sampled #FBD3D3 - pink.
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        // Scale with the circle: an 18px-radius circle carried 12px text.
        'text-size': ['step', ['get', 'point_count'], 13, 10, 15, 50, 17],
        // A count the collision engine drops leaves a circle with NO number
        // on it, which is worse than a crowded map.
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        // Halo keeps the count readable on the lightest bucket and over
        // satellite imagery; white on #60A5FA alone is too low-contrast.
        'text-halo-color': '#0B1929',
        'text-halo-width': 1,
      },
    }, beforeId)

    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'auctions',
      filter: ['!', ['has', 'point_count']],
      paint: getUnclusteredPaint(),
    }, beforeId)

    // Click cluster → zoom in
    map.on('click', 'clusters', (e: any) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      const clusterId = features[0].properties.cluster_id
      map.getSource('auctions').getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom,
        })
      })
    })

    // Click individual pin → popup + select auction
    map.on('click', 'unclustered-point', (e: any) => {
      const coords = e.features[0].geometry.coordinates.slice()
      const props = e.features[0].properties
      const point = pointLookup.current.get(props.id)

      const typeLabel = props.sale_type === 'foreclosure' ? 'Foreclosure' : 'Tax Deed'
      const recBadge = props.recommendation !== 'UNKNOWN'
        ? `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;color:#fff;background:${props.rec_color}">${props.recommendation}</span>`
        : ''

      new mapboxgl.Popup({ offset: 15, maxWidth: '280px' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:system-ui;font-size:12px;">
            <p style="font-weight:600;margin:0 0 4px 0;">${props.address}</p>
            <p style="color:#666;margin:0 0 2px 0;">${props.county} — ${typeLabel} ${recBadge}</p>
            ${props.just_value ? `<p style="color:#666;margin:0 0 2px 0;">Value: ${formatCurrency(props.just_value)}</p>` : ''}
            ${props.opening_bid ? `<p style="color:#666;margin:0 0 2px 0;">Opening Bid: ${formatCurrency(props.opening_bid)}</p>` : ''}
            ${props.auction_date ? `<p style="color:#666;margin:0;">Date: ${props.auction_date}</p>` : ''}
          </div>
        `)
        .addTo(map)

      if (point) onSelectAuction(toAuctionShape(point))
    })

    // Cursor changes
    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = '' })

    // Fit bounds
    const points = resp?.data || []
    if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      points.forEach((p) => bounds.extend([p.longitude, p.latitude]))
      map.fitBounds(bounds, { padding: 50, maxZoom: 12 })
    } else if (points.length === 1) {
      map.flyTo({
        center: [points[0].longitude, points[0].latitude],
        zoom: 10,
      })
    }
  }

  // Update cluster data when the fetched pins or colorMode change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    pointLookup.current.clear()

    if (mapRef.current.getSource('auctions')) {
      const geojson = buildGeoJSON()
      mapRef.current.getSource('auctions').setData(geojson)

      if (mapRef.current.getLayer('unclustered-point')) {
        const paint = getUnclusteredPaint()
        mapRef.current.setPaintProperty('unclustered-point', 'circle-color', paint['circle-color'])
      }

      const points = resp?.data || []
      if (points.length > 1) {
        const bounds = new mapboxgl.LngLatBounds()
        points.forEach((p) => bounds.extend([p.longitude, p.latitude]))
        mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 12 })
      } else if (points.length === 1) {
        mapRef.current.flyTo({
          center: [points[0].longitude, points[0].latitude],
          zoom: 10,
        })
      }
    } else {
      addClusterLayers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resp, mapLoaded, colorMode])

  if (mapError) {
    return (
      <div className="bg-card dark:bg-card border border-border dark:border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground dark:text-muted-foreground">{mapError}</p>
      </div>
    )
  }

  const showTruncationBanner = !!resp && resp.returned < resp.total_matching
  const noCoords = resp ? resp.total_matching - resp.total_mappable : 0
  const notShown = resp ? resp.total_mappable - resp.returned : 0

  return (
    <div className={fillParent ? 'h-full flex flex-col min-h-0' : undefined}>
      {fetchError && (
        <div
          data-testid="map-fetch-error"
          className="mb-3 px-3 py-2 rounded-md bg-primary/10 dark:bg-primary/15/20 text-xs text-primary dark:text-primary"
        >
          {fetchError}
        </div>
      )}

      {showTruncationBanner && (
        <div
          data-testid="map-truncation-banner"
          className="mb-3 px-3 py-2 rounded-md bg-foreground/10 dark:bg-foreground/15/20 text-xs text-foreground dark:text-foreground"
        >
          Showing {resp!.returned.toLocaleString()} of {resp!.total_matching.toLocaleString()} matching auctions on the map.
          {noCoords > 0 && ` ${noCoords.toLocaleString()} have no coordinates and cannot be plotted.`}
          {notShown > 0 && ` ${notShown.toLocaleString()} more exceed the display cap.`}
        </div>
      )}

      <div
        ref={wrapperRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 bg-card dark:bg-background'
            : // fillParent adds flex-1 min-h-0: this card sits inside the
              // 'h-full flex flex-col min-h-0' outer div, and a flex child
              // with no grow sizes to content — the canvas inside is h-full
              // of an auto-height parent, i.e. 0. Verified live 2026-08-20:
              // the DEFAULT /radar split view shipped with this card at 2px
              // computed height (borders only), so the landing view's map —
              // the right panel every user sees first — painted nothing while
              // ?view=map (explicit h-[600px]) worked. mapbox-gl v3 observes
              // container resize, so restoring real height also repaints.
              `bg-card dark:bg-card border border-border dark:border-border rounded-lg overflow-hidden relative${fillParent ? ' flex-1 min-h-0' : ''}`
        }
      >
        {loading && (
          <div className="absolute inset-0 bg-card/80 dark:bg-card/80 z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div
          ref={mapContainer}
          className={isFullscreen ? 'w-full h-full' : fillParent ? 'w-full h-full' : 'w-full h-[600px]'}
        />

        {/* Top-left controls */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-border dark:border-border rounded-md px-3 py-2 text-xs font-medium text-foreground dark:text-muted-foreground hover:bg-card dark:hover:bg-card transition-colors shadow-sm flex items-center gap-1.5"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
          >
            {isFullscreen ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
                Exit
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Fullscreen
              </>
            )}
          </button>

          {/* Satellite/Streets toggle */}
          <button
            onClick={toggleStyle}
            className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-border dark:border-border rounded-md px-3 py-2 text-xs font-medium text-foreground dark:text-muted-foreground hover:bg-card dark:hover:bg-card transition-colors shadow-sm flex items-center gap-1.5"
            title={isSatellite ? 'Switch to streets' : 'Switch to satellite'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            {isSatellite ? 'Streets' : 'Satellite'}
          </button>

          {/* Color mode toggle */}
          <div className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-border dark:border-border rounded-md overflow-hidden shadow-sm">
            <button
              onClick={() => setColorMode('type')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                colorMode === 'type'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground'
              }`}
            >
              Type
            </button>
            <button
              onClick={() => setColorMode('zoning')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                colorMode === 'zoning'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground'
              }`}
            >
              Zoning
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className={`absolute ${isFullscreen ? 'bottom-6 left-6' : 'bottom-3 left-3'} bg-card/90 dark:bg-card/90 backdrop-blur-sm rounded-md px-3 py-2 text-xs text-muted-foreground dark:text-muted-foreground border border-border dark:border-border z-20`}>
          {colorMode === 'type' ? (
            <>
              <div className="flex items-center gap-3">
                <span className="uppercase tracking-wide text-[10px] opacity-70 w-[68px] shrink-0">Pin type</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" /> Foreclosure</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-foreground mr-1" /> Tax Deed</span>
              </div>
              <div className="flex items-center gap-3 mt-1 pt-1 border-t border-border dark:border-border">
                <span className="uppercase tracking-wide text-[10px] opacity-70 w-[68px] shrink-0">Cluster size</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-blue-400 mr-1 text-[8px] text-white text-center leading-3">n</span> &lt;10</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-blue-600 mr-1 text-[8px] text-white text-center leading-3">n</span> 10-49</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-blue-800 mr-1 text-[8px] text-white text-center leading-3">n</span> 50+</span>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {(Object.entries(ZONING_CATEGORY_COLORS) as [ZoningCategory, typeof ZONING_CATEGORY_COLORS[ZoningCategory]][]).map(([cat, colors]) => (
                <span key={cat} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colors.hex }} />
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen: Esc hint */}
        {isFullscreen && (
          <div className="absolute top-3 right-16 z-20 bg-black/60 backdrop-blur-sm rounded-md px-2.5 py-1.5 text-xs text-white/70">
            Press <kbd className="bg-card/20 px-1 py-0.5 rounded text-white font-mono">Esc</kbd> to exit
          </div>
        )}
      </div>
    </div>
  )
}
