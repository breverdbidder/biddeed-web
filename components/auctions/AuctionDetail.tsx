'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { formatCountyLabel } from '@/lib/counties'
import type { AuctionDetail as AuctionDetailType } from '@/types/auctions'
import { parseDimensionalStandards } from '@/lib/zoning'

const AuctionDetailMap = dynamic(() => import('./AuctionDetailMap'), { ssr: false })

interface Props {
  auctionId: string
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '—'
  return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatDate(val: string | null): string {
  if (!val) return '—'
  const d = new Date(val + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function typeLabel(type: string): string {
  switch (type) {
    case 'foreclosure': return 'Foreclosure'
    case 'tax_deed': return 'Tax Deed'
    case 'active': return 'Active FC'
    case 'cancelled': return 'Cancelled'
    default: return type
  }
}

function typeBadge(type: string): string {
  switch (type) {
    case 'foreclosure':
    case 'active':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    case 'tax_deed':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
    case 'cancelled':
      return 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500'
    default:
      return 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
  }
}

const QUALITY_LABELS: Record<string, string> = {
  '1': 'Excellent', '2': 'Good', '3': 'Average', '4': 'Below Average', '5': 'Poor',
}

const CONSTRUCTION_LABELS: Record<string, string> = {
  '1': 'Fireproof Steel/Concrete', '2': 'Reinforced Concrete', '3': 'Masonry',
  '4': 'Wood Frame', '5': 'Prefab/Metal', '6': 'Minimum',
}

function InfoRow({ label, value, mono, link }: { label: string; value: string | number | null | undefined; mono?: boolean; link?: string }) {
  const display = value == null || value === '' ? '—' : String(value)
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 dark:border-slate-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-slate-400 shrink-0 w-36">{label}</span>
      {link && display !== '—' ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className={`text-sm text-bd-navy-500 dark:text-bd-orange-400 hover:underline text-right ${mono ? 'font-mono text-xs' : ''}`}>
          {display} ↗
        </a>
      ) : (
        <span className={`text-sm text-gray-900 dark:text-white text-right ${mono ? 'font-mono text-xs' : ''}`}>
          {display}
        </span>
      )}
    </div>
  )
}

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-5">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function AuctionDetail({ auctionId }: Props) {
  const router = useRouter()
  const [auction, setAuction] = useState<AuctionDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/auctions/${auctionId}`)
        if (!res.ok) {
          setError(res.status === 404 ? 'Auction not found' : 'Failed to load auction')
          return
        }
        const data = await res.json()
        setAuction(data)
      } catch {
        setError('Failed to load auction')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [auctionId])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-bd-navy-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">Loading auction...</p>
        </div>
      </div>
    )
  }

  if (error || !auction) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <p className="text-red-500 text-sm">{error || 'Auction not found'}</p>
          <button
            onClick={() => router.push('/auctions')}
            className="text-sm text-bd-navy-500 hover:text-bd-navy-700 dark:text-bd-orange-400 dark:hover:text-bd-orange-300 underline"
          >
            ← Back to Auctions
          </button>
        </div>
      </div>
    )
  }

  const hasCoords = auction.latitude != null && auction.longitude != null
  const daysUntilAuction = auction.auction_date
    ? Math.ceil((new Date(auction.auction_date + 'T00:00:00').getTime() - Date.now()) / 86400000)
    : null

  // Build BCPAO property page link for Brevard parcels
  const bcpaoLink = auction.county === 'Brevard' && auction.parcel_id
    ? `https://www.bcpao.us/PropertySearch/#/parcel/${encodeURIComponent(auction.parcel_id)}`
    : null

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Back + Header */}
        <div>
          <button
            onClick={() => router.push('/auctions')}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 mb-3 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Auctions
          </button>

          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {auction.property_address || 'No Address'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                {formatCountyLabel(auction.county)} County &middot; {auction.case_number}
              </p>
            </div>

            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${typeBadge(auction.auction_type)}`}>
              {typeLabel(auction.auction_type)}
            </span>

            {auction.recommendation && auction.recommendation !== 'UNKNOWN' && (
              <span
                className="px-2.5 py-1 text-xs font-bold rounded-full text-white shrink-0"
                style={{ backgroundColor: auction.recommendation_color }}
              >
                {auction.recommendation}
              </span>
            )}

            {daysUntilAuction != null && daysUntilAuction >= 0 && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shrink-0">
                {daysUntilAuction === 0 ? 'Today' : daysUntilAuction === 1 ? 'Tomorrow' : `${daysUntilAuction} days`}
              </span>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left column: Property details */}
          <div className="lg:col-span-3 space-y-6">

            {/* Photo */}
            {auction.photo_url && !photoError && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <img
                  src={auction.photo_url}
                  alt={auction.property_address || 'Property photo'}
                  className="w-full h-64 object-cover"
                  onError={() => setPhotoError(true)}
                />
                {auction.county === 'Brevard' && (
                  <p className="text-xs text-gray-400 dark:text-slate-600 px-3 py-1.5">
                    Photo: Brevard County Property Appraiser
                  </p>
                )}
              </div>
            )}

            {/* Case Details */}
            <SectionCard title="Case Details" icon="📋">
              <InfoRow label="Case Number" value={auction.case_number} mono />
              <InfoRow label="Auction Type" value={typeLabel(auction.auction_type)} />
              <InfoRow label="Auction Date" value={formatDate(auction.auction_date)} />
              <InfoRow label="Plaintiff" value={auction.plaintiff} />
              {auction.opening_bid != null && (
                <InfoRow label="Opening Bid" value={formatCurrency(auction.opening_bid)} />
              )}
              {auction.source_url && (
                <InfoRow label="Source" value="View Original" link={auction.source_url} />
              )}
            </SectionCard>

            {/* Property Details */}
            <SectionCard title="Property Details" icon="🏠">
              <InfoRow label="Owner" value={auction.owner_name} />
              <InfoRow
                label="Parcel ID"
                value={auction.parcel_id}
                mono
                link={bcpaoLink || undefined}
              />
              <InfoRow label="Just Value" value={formatCurrency(auction.just_value)} />
              <InfoRow label="Land Value" value={formatCurrency(auction.land_value)} />
              <InfoRow label="Year Built" value={auction.year_built && auction.year_built > 0 ? auction.year_built : null} />
              <InfoRow label="Living Area" value={auction.living_area && auction.living_area > 0 ? `${auction.living_area.toLocaleString()} sqft` : null} />
              <InfoRow label="Lot Size" value={auction.lot_size ? `${auction.lot_size.toLocaleString()} sqft` : null} />
              <InfoRow label="Vacant Land" value={auction.is_vacant_land == null ? null : auction.is_vacant_land ? 'Yes' : 'No'} />
            </SectionCard>

            {/* Zoning & Classification */}
            <SectionCard title="Zoning & Classification" icon="🗺️">
              {auction.zoning ? (
                <>
                  <InfoRow label="DOR Use Code" value={auction.zoning.dor_use_code} mono />
                  <InfoRow label="Use Description" value={auction.zoning.dor_use_description} />
                  <InfoRow label="Zone Code" value={auction.zoning.zone_code} />
                  <InfoRow label="Municipality" value={auction.zoning.municipality} />
                  <InfoRow label="Future Land Use" value={auction.zoning.future_land_use} />
                  <InfoRow label="Quality" value={auction.zoning.improvement_quality ? (QUALITY_LABELS[auction.zoning.improvement_quality] || auction.zoning.improvement_quality) : null} />
                  <InfoRow label="Construction" value={auction.zoning.construction_class ? (CONSTRUCTION_LABELS[auction.zoning.construction_class] || auction.zoning.construction_class) : null} />
                  {auction.zoning.last_sale_price && (
                    <InfoRow label="Last Sale" value={`${formatCurrency(auction.zoning.last_sale_price)} (${auction.zoning.last_sale_year})`} />
                  )}
                  {auction.zoning.homestead_value && (
                    <InfoRow label="Homestead Value" value={formatCurrency(auction.zoning.homestead_value)} />
                  )}
                </>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-400 dark:text-slate-500">
                    Zoning data not yet available for {auction.county} County
                  </p>
                  <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">
                    Parcel enrichment in progress — check back soon
                  </p>
                </div>
              )}
            </SectionCard>

            {/* Dimensional Standards */}
            {auction.zoning?.zone_code && (() => {
              const dims = parseDimensionalStandards(auction.zoning?.zone_code ?? null, auction.zoning?.future_land_use ?? null)
              if (!dims) return null
              return (
                <SectionCard title="Dimensional Standards" icon="📐">
                  <InfoRow label="Min Lot Size" value={dims.minLotSize} />
                  <InfoRow label="Max Height" value={dims.maxHeight} />
                  <InfoRow label="Setbacks" value={dims.setbacks} />
                  <InfoRow label="Density" value={dims.density} />
                  <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-2">
                    Estimates based on zone code pattern. Verify with local municipality.
                  </p>
                </SectionCard>
              )
            })()}
          </div>

          {/* Right column: Map + Quick Stats */}
          <div className="lg:col-span-2 space-y-6">

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Just Value</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(auction.just_value)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Land Value</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(auction.land_value)}
                </p>
              </div>
              {auction.opening_bid != null && auction.opening_bid > 0 && (
                <div className="col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Opening Bid</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                    {formatCurrency(auction.opening_bid)}
                  </p>
                </div>
              )}
              {auction.just_value && auction.just_value > 0 && auction.land_value != null && (
                <div className="col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">Improvement Ratio</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {(((auction.just_value - auction.land_value) / auction.just_value) * 100).toFixed(0)}%
                    <span className="text-xs font-normal text-gray-400 ml-1">improvements</span>
                  </p>
                </div>
              )}
            </div>

            {/* Shapira Formula Scoring */}
            {auction.recommendation && auction.recommendation !== 'UNKNOWN' && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase mb-3">Investment Score</p>
                <div className="text-center mb-3">
                  <span
                    className="inline-block px-4 py-2 rounded-lg text-xl font-bold text-white"
                    style={{ backgroundColor: auction.recommendation_color }}
                  >
                    {auction.recommendation}
                  </span>
                </div>
                {auction.max_bid != null && (
                  <div className="text-center mb-2">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Max Bid</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(auction.max_bid)}
                    </p>
                  </div>
                )}
                {auction.bid_ratio != null && (
                  <div className="text-center mb-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Bid-to-Value Ratio</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{auction.bid_ratio}%</p>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 dark:text-slate-600 text-center mt-2">
                  Shapira Formula&trade; &middot; (ARV &times; 70%) - Repairs - $10K - MIN($25K, 15% ARV)
                </p>
              </div>
            )}

            {/* Mini Map */}
            {hasCoords && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <AuctionDetailMap
                  lat={auction.latitude!}
                  lng={auction.longitude!}
                  label={auction.property_address || 'Property'}
                  type={auction.sale_type || auction.auction_type}
                />
              </div>
            )}

            {/* Coordinates */}
            {hasCoords && (
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase mb-2">Coordinates</p>
                <p className="text-xs font-mono text-gray-700 dark:text-slate-300">
                  {auction.latitude!.toFixed(6)}, {auction.longitude!.toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${auction.latitude},${auction.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-bd-navy-500 dark:text-bd-orange-400 hover:underline mt-1 inline-block"
                >
                  Open in Google Maps ↗
                </a>
              </div>
            )}

            {/* Address Status */}
            {auction.address_status && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-400 uppercase mb-1">Address Status</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {auction.address_status.replace(/_/g, ' ')}
                </p>
              </div>
            )}

            {/* External Links */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase mb-2">External Links</p>
              {bcpaoLink && (
                <a href={bcpaoLink} target="_blank" rel="noopener noreferrer"
                  className="block text-sm text-bd-navy-500 dark:text-bd-orange-400 hover:underline">
                  BCPAO Property Page ↗
                </a>
              )}
              {auction.source_url && (
                <a href={auction.source_url} target="_blank" rel="noopener noreferrer"
                  className="block text-sm text-bd-navy-500 dark:text-bd-orange-400 hover:underline">
                  Auction Source ↗
                </a>
              )}
              {hasCoords && (
                <a href={`https://www.google.com/maps/@${auction.latitude},${auction.longitude},17z/data=!3m1!1e3`}
                  target="_blank" rel="noopener noreferrer"
                  className="block text-sm text-bd-navy-500 dark:text-bd-orange-400 hover:underline">
                  Google Maps Satellite ↗
                </a>
              )}
            </div>

            {/* Data Freshness */}
            {auction.enriched_at && (
              <p className="text-xs text-gray-400 dark:text-slate-600 text-center">
                Enriched: {new Date(auction.enriched_at).toLocaleDateString()} &middot;
                Scraped: {auction.scraped_at ? new Date(auction.scraped_at).toLocaleDateString() : '—'}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
