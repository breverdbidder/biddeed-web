/**
 * Heatmap KPI layer + gate config — single source of truth (issue #75).
 *
 * "Owner Decisions" (SIGNAL$ allotments, add-on packs, free sample scope,
 * annual discount depth, free-tier GEV teaser, $399 launch timing, seat
 * policy) are deliberately NOT hardcoded anywhere in the heatmap UI. Gate
 * copy reads plan names/prices from components/deed-home/LandingSections.tsx
 * PLANS (the canon-gate-validated pricing source) so a pricing change never
 * requires touching this feature's code.
 */
export type LayerTier = 'free' | 'signup' | 'paid'
export type Granularity = 'county' | 'zip'

export interface KpiLayer {
  id: string
  label: string
  tier: LayerTier
  /** Whether real, sourced data backs this layer today. */
  hasData: boolean
  source: string
  vintage: string
  unit: 'usd' | 'usd_per_month' | 'percent' | 'index' | 'count_per_10k'
  description: string
  /** Shown on the layer when hasData is false — never fabricate a number instead. */
  noDataReason?: string
}

// Investor is the cheapest paid tier today ($99/mo) — the paid gate points
// there, not straight to Pro, so the upsell matches the cheapest plan that
// actually unlocks the capability. The price label itself is NOT hardcoded
// here — components/heatmap/GateOverlay.tsx (a client component) reads it
// live from components/deed-home/LandingSections.tsx PLANS, the single
// canon-gate-validated pricing source. This file must stay importable from
// server-only routes (see app/api/analytics/event, .../scorecard,
// .../premium), and PLANS lives in a 'use client' module — importing it here
// turned PLANS into an opaque RSC client reference in server bundles
// (`PLANS.find is not a function` at build time), not the real array.
export const PAID_GATE_TIER_SLUG = 'investor'

export const KPI_LAYERS: KpiLayer[] = [
  {
    id: 'market_direction',
    label: 'Median Home Value',
    tier: 'free',
    hasData: true,
    source: 'U.S. Census Bureau ACS 5-Year Estimates, table B25077',
    vintage: 'ACS 2020-2024',
    unit: 'usd',
    description: 'Median value of owner-occupied homes, county level. The free entry KPI — always visible, no account required.',
  },
  {
    id: 'median_income',
    label: 'Median Household Income',
    tier: 'signup',
    hasData: true,
    source: 'U.S. Census Bureau ACS 5-Year Estimates, table B19013',
    vintage: 'ACS 2020-2024',
    unit: 'usd',
    description: 'Median household income, county level.',
  },
  {
    id: 'zhvi_yoy',
    label: 'Home Value, YoY Change',
    tier: 'signup',
    hasData: false,
    source: 'Zillow ZHVI (pending pipeline)',
    vintage: 'n/a',
    unit: 'percent',
    description: 'Year-over-year appreciation. Documented gap: no Zillow ETL feeds this repo yet.',
    noDataReason: 'Zillow ZHVI pipeline not yet built for biddeed-web — see docs/spec/75.md.',
  },
  {
    id: 'inventory',
    label: 'For-Sale Inventory',
    tier: 'signup',
    hasData: false,
    source: 'Zillow (pending pipeline)',
    vintage: 'n/a',
    unit: 'count_per_10k',
    description: 'Active for-sale listing count. Documented gap: no Zillow ETL feeds this repo yet.',
    noDataReason: 'Zillow inventory pipeline not yet built for biddeed-web — see docs/spec/75.md.',
  },
  {
    id: 'dom',
    label: 'Days on Market',
    tier: 'signup',
    hasData: false,
    source: 'Zillow (pending pipeline)',
    vintage: 'n/a',
    unit: 'index',
    description: 'Median days on market. Documented gap: no Zillow ETL feeds this repo yet.',
    noDataReason: 'Zillow DOM pipeline not yet built for biddeed-web — see docs/spec/75.md.',
  },
  {
    id: 'foreclosure_density',
    label: 'Foreclosure Density',
    tier: 'paid',
    hasData: true,
    source: 'BidDeed.AI live auction corpus (multi_county_auctions) / ACS population (B01003)',
    vintage: 'live, updated per scrape cycle',
    unit: 'count_per_10k',
    description: 'Live + upcoming foreclosure and tax-deed auctions per 10,000 residents — our differentiator, not available from Reventure or Zillow.',
  },
  {
    id: 'price_cut_pct',
    label: 'Price-Cut %',
    tier: 'paid',
    hasData: false,
    source: 'Zillow (pending pipeline)',
    vintage: 'n/a',
    unit: 'percent',
    description: 'Share of listings with a price reduction. Documented gap: no Zillow ETL feeds this repo yet.',
    noDataReason: 'Zillow price-cut pipeline not yet built for biddeed-web — see docs/spec/75.md.',
  },
  {
    id: 'forecast_1yr',
    label: '1-Year Forecast',
    tier: 'paid',
    hasData: false,
    source: 'BidDeed.AI model (pending)',
    vintage: 'n/a',
    unit: 'percent',
    description: 'Forecast home-value change. Documented gap: our forecast model does not yet cover this geography.',
    noDataReason: 'Forecast model not yet built for this geography — see docs/spec/75.md.',
  },
]

export const FREE_LAYER_ID = 'market_direction'

export function getLayer(id: string): KpiLayer | undefined {
  return KPI_LAYERS.find((l) => l.id === id)
}

export const GRANULARITY_GATE: Record<Granularity, LayerTier> = {
  county: 'free',
  zip: 'signup',
}

/** Funnel event names this feature emits — mirrored in the Supabase check constraint. */
export const FUNNEL_EVENTS = [
  'heatmap_view',
  'layer_change',
  'gate_shown',
  'signup_started',
  'signup_completed',
  'premium_gate_shown',
  'parcel_drill',
  'signal_cta_click',
  'upgrade_click',
  'purchase_referred',
  'homepage_map_view',
  'homepage_map_interact',
  'homepage_kpi_layer_change',
  'homepage_area_teaser_click',
  'homepage_to_maps_click',
] as const

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number]
