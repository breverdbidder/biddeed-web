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

  // Parcel enrichment, via public.fl_parcel_for_auction.
  //
  // What was here before was broken three ways at once and failed silently:
  //
  //   * Strategies 1 and 2 keyed on auction.fl_parcel_id and auction.fl_co_no.
  //     Neither is a column on multi_county_auctions, so both were always
  //     undefined and neither branch ever executed.
  //   * Every strategy asked for a `lot_size` column that does not exist on
  //     fl_parcels (it is lnd_sqfoot). PostgREST rejects the whole select with
  //     400 "column fl_parcels.lot_size does not exist" - and `error` was
  //     discarded here, so the zoning panel has been empty on every auction
  //     detail page, with nothing logged.
  //   * The surviving fallback was an unanchored ILIKE across all 10,516,312
  //     fl_parcels rows with no county scoping: 44,489 ms and 10.5M rows
  //     filtered, measured 2026-08-18. It never actually ran only because the
  //     400 above killed the request first - correcting the column name on its
  //     own would have turned every detail page into a timeout. It could also
  //     return a parcel from a different county and present that property''s
  //     owner, assessed value and last sale price as this auction''s.
  //
  // The RPC does two county-scoped equality probes served by
  // fl_parcels_co_no_parcel_id_key, so it cannot scan the table or cross a
  // county line, and it reports which probe matched. Measured across 61
  // counties: 45 resolved (27 exact, 18 normalized), 0 cross-county, total time
  // under a millisecond. Coverage on 500 sampled auctions is 76.2%, up from
  // 57.8% for exact-match alone; the rest return no enrichment on purpose,
  // because a plausible wrong parcel is worse than none for someone deciding
  // what to bid.
  let parcelData: Record<string, unknown> | null = null

  if (auction.parcel_id && auction.county) {
    const { data, error: parcelError } = await supabase
      .rpc('fl_parcel_for_auction', {
        p_county: auction.county,
        p_parcel_id: auction.parcel_id,
      })
      .maybeSingle()

    // Surface the failure instead of silently rendering an empty panel, which
    // is exactly how the lot_size 400 stayed invisible.
    if (parcelError) {
      console.error('fl_parcel_for_auction failed', {
        county: auction.county,
        parcel_id: auction.parcel_id,
        error: parcelError.message,
      })
    }
    parcelData = data as Record<string, unknown> | null
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
  // fl_parcels calls this lnd_sqfoot. It was read as parcelData.lot_size, which
  // is the multi_county_auctions name - always undefined here.
  const flLotSize = parcelData ? (parcelData.lnd_sqfoot as number | null) : null
  const flOwnerName = parcelData ? (parcelData.own_name as string | null) : null

  // Shapira Formula scoring.
  //
  // just_value, land_value and living_area are NOT columns on
  // multi_county_auctions - they are three of the phantom fields documented in
  // types/auctions.ts - so `auction.just_value` was always undefined. Its only
  // fallback, flJustValue, was always null too, because the fl_parcels select
  // was failing with a 400 on the non-existent lot_size column. justValue was
  // therefore falsy on every request, and this block has never once produced a
  // recommendation: every auction detail page returned UNKNOWN with a null
  // maxBid. fl_parcels.jv is the real source, so read it directly.
  const justValue = flJustValue
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
    just_value: flJustValue,
    land_value: flLandValue,
    year_built: (auction.year_built as number | null) ?? flYearBuilt,
    living_area: flLivingArea,
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
