import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveBcpaoPhotoUrl } from '@/lib/bcpao'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Florida DOR Use Code descriptions.
 * Source: Florida Dept of Revenue property classification codes.
 */
const DOR_USE_CODES: Record<string, string> = {
  '000': 'Vacant Residential',
  '001': 'Single Family Residential',
  '002': 'Mobile Home',
  '003': 'Multi-Family (2–9 units)',
  '004': 'Condominium',
  '005': 'Cooperative',
  '006': 'Retirement Home (not nursing)',
  '007': 'Misc Residential',
  '008': 'Multi-Family (10+ units)',
  '009': 'Residential Common Area',
  '010': 'Vacant Commercial',
  '011': 'Store / Retail',
  '012': 'Mixed Use (Res + Comm)',
  '014': 'Supermarket',
  '016': 'Community Shopping Center',
  '017': 'Office (1-story)',
  '018': 'Office (multi-story)',
  '019': 'Medical Office / Clinic',
  '020': 'Tourist Attraction / Commercial',
  '021': 'Restaurant / Cafeteria',
  '022': 'Drive-In Restaurant',
  '023': 'Financial Institution',
  '024': 'Insurance Office',
  '025': 'Repair Service Shop',
  '026': 'Service Station',
  '027': 'Automotive Sales / Repair',
  '028': 'Parking Lot / Garage',
  '029': 'Wholesale / Produce',
  '030': 'Florist / Greenhouse',
  '033': 'Nightclub / Bar / Lounge',
  '034': 'Bowling Alley',
  '038': 'Golf Course',
  '039': 'Hotel / Motel',
  '040': 'Vacant Industrial',
  '041': 'Light Manufacturing',
  '042': 'Heavy Manufacturing',
  '043': 'Lumber Yard',
  '048': 'Warehousing / Distribution',
  '049': 'Open Storage',
  '050': 'Vacant Agricultural (Improved)',
  '051': 'Cropland (Row Crops)',
  '052': 'Improved Pasture',
  '053': 'Timber',
  '060': 'Grazing Land (Improved)',
  '061': 'Grazing Land (Semi-Improved)',
  '066': 'Orchard / Grove / Vineyard',
  '067': 'Poultry / Bees / Fish / etc',
  '069': 'Ornamental / Misc Ag',
  '070': 'Vacant Institutional',
  '071': 'Church / Worship',
  '072': 'Private School / College',
  '073': 'Private Hospital',
  '074': 'Home for the Aged',
  '075': 'Orphanage / Non-Profit',
  '076': 'Mortuary / Cemetery',
  '077': 'Club / Lodge / Union Hall',
  '080': 'Undefined / Transitional',
  '082': 'Forest / Parks / Rec (County)',
  '083': 'Public County School',
  '085': 'Municipal / Public',
  '086': 'State / Federal / Other',
  '089': 'Municipal / Other',
  '091': 'Utility / Gas / Electric',
  '092': 'Mining / Minerals / Petroleum',
  '094': 'Right-of-Way / Road',
  '095': 'River / Lake / Submerged',
  '097': 'Outdoor Rec / Park',
  '099': 'Acreage not Zoned Ag',
}


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabase()

  // auction_detail_enriched returns every multi_county_auctions column PLUS a
  // zw_parcels join on normalised pin_clean (owner, values, year built, living
  // area, DOR use code, zoning) and the sale_type/assessed_value fallbacks.
  const { data: auction, error } = await supabase
    .rpc('auction_detail_enriched', { p_id: id })

  if (error || !auction) {
    return NextResponse.json(
      { error: 'Auction not found' },
      { status: 404 }
    )
  }

  // Try to enrich with fl_parcels data (zoning, etc.)
  let zoning: {
    dor_use_code: string | null
    dor_use_description: string | null
    zone_code: string | null
    municipality: string | null
    future_land_use: string | null
    improvement_quality: string | null
    construction_class: string | null
    last_sale_price: number | null
    last_sale_year: number | null
    homestead_value: number | null
  } | null = null

  // Try fl_parcels lookup using fl_parcel_id (DOR format, set by enrichment pipeline)
  // Falls back to parcel_id with ILIKE if fl_parcel_id is not populated
  const parcelFields = 'dor_uc, zone_code, municipality, future_land_use, imp_qual, const_clas, sale_prc1, sale_yr1, jv_hmstd, jv, lnd_val, act_yr_blt, tot_lvg_ar, lot_size, own_name'
  let parcelData: Record<string, unknown> | null = null

  if (auction.fl_parcel_id) {
    // Strategy 1: Exact match on fl_parcel_id (most reliable — set by enrichment)
    const { data } = await supabase
      .from('fl_parcels')
      .select(parcelFields)
      .eq('parcel_id', auction.fl_parcel_id)
      .limit(1)
      .maybeSingle()
    parcelData = data
  }

  if (!parcelData && auction.fl_co_no && auction.parcel_id) {
    // Strategy 2: Match by co_no + parcel_id substring (handles format differences)
    const cleanParcel = auction.parcel_id.replace(/[\s\-\*]/g, '')
    if (cleanParcel.length >= 4) {
      const { data } = await supabase
        .from('fl_parcels')
        .select(parcelFields)
        .eq('co_no', auction.fl_co_no)
        .ilike('parcel_id', `%${cleanParcel}%`)
        .limit(1)
        .maybeSingle()
      parcelData = data
    }
  }

  if (!parcelData && auction.parcel_id) {
    // Strategy 3: Broad ILIKE fallback (original behavior)
    const cleanParcel = auction.parcel_id.replace(/[\s\-\*]/g, '')
    if (cleanParcel.length >= 4) {
      const { data } = await supabase
        .from('fl_parcels')
        .select(parcelFields)
        .ilike('parcel_id', `%${cleanParcel}%`)
        .limit(1)
        .maybeSingle()
      parcelData = data
    }
  }

  if (parcelData) {
    const dorCode = (parcelData.dor_uc as string)?.padStart(3, '0') || null
    zoning = {
      dor_use_code: dorCode,
      dor_use_description: dorCode ? (DOR_USE_CODES[dorCode] || `Code ${dorCode}`) : null,
      zone_code: parcelData.zone_code as string | null,
      municipality: parcelData.municipality as string | null,
      future_land_use: parcelData.future_land_use as string | null,
      improvement_quality: parcelData.imp_qual as string | null,
      construction_class: parcelData.const_clas as string | null,
      last_sale_price: (parcelData.sale_prc1 as number) > 0 ? parcelData.sale_prc1 as number : null,
      last_sale_year: (parcelData.sale_yr1 as number) > 0 ? parcelData.sale_yr1 as number : null,
      homestead_value: (parcelData.jv_hmstd as number) > 0 ? parcelData.jv_hmstd as number : null,
    }
  }

  // Generate BCPAO photo URL for Brevard if no photo_url exists
  let photoUrl = auction.photo_url
  let bcpaoPhotoUrl: string | null = null
  if (auction.county === 'Brevard' && auction.parcel_id) {
    bcpaoPhotoUrl = await resolveBcpaoPhotoUrl(auction.parcel_id)
    if (!photoUrl) {
      photoUrl = bcpaoPhotoUrl
    }
  }

  // ── fl_parcels valuation fallbacks ─────────────────────────────────
  // When multi_county_auctions fields are null (enrichment not yet run),
  // use fl_parcels as the source of truth for property attributes.
  const flJustValue = parcelData ? (parcelData.jv as number | null) : null
  const flLandValue = parcelData ? (parcelData.lnd_val as number | null) : null
  const flYearBuilt = parcelData ? (parcelData.act_yr_blt as number | null) : null
  const flLivingArea = parcelData ? (parcelData.tot_lvg_ar as number | null) : null
  const flLotSize = parcelData ? (parcelData.lot_size as number | null) : null
  const flOwnerName = parcelData ? (parcelData.own_name as string | null) : null

  // Shapira Formula scoring
  const justValue = (auction.just_value as number | null) ?? flJustValue
  const openingBid = auction.opening_bid as number | null
  let recommendation: 'BID' | 'REVIEW' | 'SKIP' | 'UNKNOWN' = 'UNKNOWN'
  let maxBid: number | null = null
  let bidRatio: number | null = null
  let recommendationColor = '#6B7280' // gray

  if (justValue && justValue > 0) {
    maxBid = Math.round((justValue * 0.70) - 10000 - Math.min(25000, justValue * 0.15))
    if (maxBid < 0) maxBid = 0
    const compareBid = openingBid || justValue
    if (compareBid > 0) {
      bidRatio = Math.round((maxBid / compareBid) * 100)
      if (bidRatio >= 75) {
        recommendation = 'BID'
        recommendationColor = '#22C55E'
      } else if (bidRatio >= 60) {
        recommendation = 'REVIEW'
        recommendationColor = '#F59E0B'
      } else {
        recommendation = 'SKIP'
        recommendationColor = '#EF4444'
      }
    }
  }

  // Build enriched response — merge fl_parcels fallbacks for null KPIs
  const response = {
    ...auction,
    just_value: (auction.just_value as number | null) ?? flJustValue,
    land_value: (auction.land_value as number | null) ?? flLandValue,
    year_built: (auction.year_built as number | null) ?? flYearBuilt,
    living_area: (auction.living_area as number | null) ?? flLivingArea,
    lot_size: (auction.lot_size as number | null) ?? flLotSize,
    owner_name: (auction.owner_name as string | null) ?? flOwnerName,
    photo_url: photoUrl,
    bcpao_photo_url: bcpaoPhotoUrl,
    zoning,
    recommendation,
    recommendation_color: recommendationColor,
    max_bid: maxBid,
    bid_ratio: bidRatio,
    source_url: auction.source_url,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
    },
  })
}
