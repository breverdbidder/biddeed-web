'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import HeatmapMap from './HeatmapMap'
import LayerPanel from './LayerPanel'
import ScorecardPanel from './ScorecardPanel'
import BottomSheet from './BottomSheet'
import GateOverlay from './GateOverlay'
import { apiUrl } from '@/lib/api'
import { trackHeatmapEvent } from '@/lib/analytics/track'
import { getLayer, GRANULARITY_GATE, type Granularity } from '@/lib/heatmap/config'
import { VALUE_SCALE, DENSITY_SCALE } from '@/lib/heatmap/colorScales'
import { buildHeatmapSearchParams } from '@/lib/heatmap/url-state'
import type { HeatmapUrlState, ScorecardResponse } from '@/lib/heatmap/types'
import acsData from '@/lib/heatmap/data/fl-county-acs-2024.json'
import type { CountyAcsDataset } from '@/lib/heatmap/types'

const ACS = acsData as unknown as CountyAcsDataset

interface Props {
  initialState: HeatmapUrlState
  signedIn: boolean
  paidEntitled: boolean
}

function scaleForLayer(layerId: string): string[] {
  return layerId === 'foreclosure_density' ? DENSITY_SCALE : VALUE_SCALE
}

export default function MapsPageClient({ initialState, signedIn, paidEntitled }: Props) {
  const router = useRouter()
  const [activeLayerId, setActiveLayerId] = useState(initialState.layer)
  const [granularity, setGranularity] = useState<Granularity>(initialState.granularity)
  const [selectedFips, setSelectedFips] = useState<string | null>(initialState.selected)
  const [gateMessage, setGateMessage] = useState<{ kind: 'signup' | 'paid'; label: string } | null>(null)
  const [premiumValues, setPremiumValues] = useState<Record<string, number | null> | null>(null)
  const [premiumBlocked, setPremiumBlocked] = useState(false)
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null)
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [scorecardError, setScorecardError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const layer = getLayer(activeLayerId)!

  // URL sync — every change (layer, granularity, selection) is shareable.
  useEffect(() => {
    const sp = buildHeatmapSearchParams({ layer: activeLayerId, granularity, selected: selectedFips })
    router.replace(`/maps?${sp.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId, granularity, selectedFips])

  useEffect(() => {
    trackHeatmapEvent('heatmap_view', { surface: 'maps', kpi_layer: activeLayerId, geography_level: granularity })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const countyValues = useMemo<Record<string, number | null>>(() => {
    if (layer.id === 'foreclosure_density') return premiumValues ?? {}
    if (!layer.hasData) return {}
    const field = layer.id === 'median_income' ? 'median_household_income' : 'median_home_value'
    const out: Record<string, number | null> = {}
    for (const row of ACS.counties) {
      out[row.county_fips] = (row as any)[field] ?? null
    }
    return out
  }, [layer, premiumValues])

  // Fetch the entitlement-gated premium layer server-side — this is the one
  // layer with real, proprietary data (foreclosure density), so unlike the
  // ACS layers it must round-trip through requireCapability() again, not
  // just trust the initial server-rendered paidEntitled flag.
  useEffect(() => {
    if (layer.id !== 'foreclosure_density') return
    setPremiumBlocked(false)
    fetch(apiUrl(`/api/heatmap/premium?layer=${layer.id}`))
      .then(async (res) => {
        if (res.status === 402) {
          setPremiumBlocked(true)
          setPremiumValues(null)
          return
        }
        const json = await res.json()
        if (!json.has_data) {
          setPremiumValues({})
          return
        }
        const values: Record<string, number | null> = {}
        for (const [fips, v] of Object.entries(json.counties as Record<string, { value: number }>)) {
          values[fips] = v.value
        }
        setPremiumValues(values)
      })
      .catch(() => setPremiumValues({}))
  }, [layer.id])

  const fetchScorecard = useCallback((fips: string) => {
    setScorecardLoading(true)
    setScorecardError(null)
    fetch(apiUrl(`/api/heatmap/scorecard?county_fips=${fips}&layer=${activeLayerId}`))
      .then((r) => {
        if (!r.ok) throw new Error(`scorecard request failed (${r.status})`)
        return r.json()
      })
      .then((json: ScorecardResponse) => {
        setScorecard(json)
        if (json.top_parcel) {
          trackHeatmapEvent('parcel_drill', {
            geography_level: 'county',
            geography_id: fips,
            kpi_layer: activeLayerId,
            metadata: { mca_id: json.top_parcel.id },
          })
        }
      })
      .catch(() => {
        setScorecard(null)
        setScorecardError('Could not load the scorecard for this county. Please retry shortly.')
      })
      .finally(() => setScorecardLoading(false))
  }, [activeLayerId])

  useEffect(() => {
    if (selectedFips) fetchScorecard(selectedFips)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFips, activeLayerId])

  const handleSelectCounty = useCallback((fips: string, _name: string) => {
    setSelectedFips(fips)
  }, [])

  const handleSelectLayer = useCallback(
    (layerId: string) => {
      const target = getLayer(layerId)
      if (!target) return
      if (target.tier === 'signup' && !signedIn) {
        setGateMessage({ kind: 'signup', label: target.label })
        trackHeatmapEvent('gate_shown', { kpi_layer: layerId })
        return
      }
      if (target.tier === 'paid' && !paidEntitled) {
        setGateMessage({ kind: 'paid', label: target.label })
        trackHeatmapEvent('premium_gate_shown', { kpi_layer: layerId })
        return
      }
      setGateMessage(null)
      setActiveLayerId(layerId)
      trackHeatmapEvent('layer_change', { kpi_layer: layerId, geography_level: granularity })
    },
    [signedIn, paidEntitled, granularity]
  )

  const handleSelectGranularity = useCallback(
    (g: Granularity) => {
      const gateTier = GRANULARITY_GATE[g]
      if (gateTier === 'signup' && !signedIn) {
        setGateMessage({ kind: 'signup', label: 'ZIP-level granularity' })
        trackHeatmapEvent('gate_shown', { geography_level: g })
        return
      }
      setGateMessage(null)
      setGranularity(g)
    },
    [signedIn]
  )

  const copyLink = useCallback(() => {
    if (typeof window === 'undefined') return
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  const premiumGateActive = layer.tier === 'paid' && (premiumBlocked || !paidEntitled)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-medium text-foreground sm:text-xl">
          Florida Auction Intelligence Map
        </h1>
        <button
          type="button"
          onClick={copyLink}
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
        >
          <Link2 className="size-3.5" aria-hidden />
          {copied ? 'Link copied' : 'Copy shareable link'}
        </button>
      </div>

      <LayerPanel
        activeLayerId={activeLayerId}
        granularity={granularity}
        signedIn={signedIn}
        paidEntitled={paidEntitled}
        onSelectLayer={handleSelectLayer}
        onSelectGranularity={handleSelectGranularity}
      />

      {gateMessage && (
        <GateOverlay kind={gateMessage.kind} label={`Unlock ${gateMessage.label}`} signedIn={signedIn} />
      )}

      {granularity === 'zip' && (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          ZIP-level (ZCTA5) KPI data is a documented gap — no pipeline feeds it yet. Showing county-level
          boundaries below in the meantime; see docs/spec/75.md.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
        <div className="relative">
          <HeatmapMap
            countyValues={countyValues}
            colorScale={scaleForLayer(activeLayerId)}
            selectedFips={selectedFips}
            onSelectCounty={handleSelectCounty}
            className="h-[46vh] sm:h-[60vh] lg:h-[70vh]"
          />
          {premiumGateActive && (
            <div className="absolute inset-x-3 top-3 z-20">
              <GateOverlay kind="paid" label={`${layer.label} is a paid layer`} signedIn={signedIn} />
            </div>
          )}
        </div>

        <div className="hidden rounded-lg border border-border bg-card sm:block lg:h-[70vh] lg:overflow-y-auto">
          <ScorecardPanel
            loading={scorecardLoading}
            data={scorecard}
            error={scorecardError}
            onJumpToCounty={(fips) => setSelectedFips(fips)}
          />
        </div>
      </div>

      <div className="sm:hidden">
        <BottomSheet
          peek={
            scorecard
              ? `${scorecard.county_name} County · ${scorecard.live_auction_count} live auctions`
              : 'Tap a county for its scorecard'
          }
        >
          <ScorecardPanel
            loading={scorecardLoading}
            data={scorecard}
            error={scorecardError}
            onJumpToCounty={(fips) => setSelectedFips(fips)}
          />
        </BottomSheet>
      </div>
    </div>
  )
}
