'use client'

import { formatCountyLabel } from '@/lib/counties'
import type { Auction } from '@/types/auctions'

/**
 * The one detail card every auction pin opens, whichever surface the pin was
 * on: /radar (map, table, sidebar), /maps and the homepage map. Extracted
 * from AuctionsLayout's selected-auction modal 2026-09-18, when the same
 * card had to serve the homepage and /maps pins too (owner decision: "The
 * pin from the home page should give this minimum data as well for each
 * property").
 *
 * Missingness is labelled, never filled: a field the county source has not
 * published renders "Not published", not a blank and never an invented
 * value. Parties are auction-type-appropriate - plaintiff/defendant are
 * foreclosure concepts, so a tax deed shows its certificate number and
 * owner instead of two permanently empty party fields. (There is no
 * defendant column on multi_county_auctions at all; the old card rendered
 * it as an em-dash on every row.)
 */

function Field({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  const has = value != null && value !== ''
  return (
    <div>
      <p className="text-muted-foreground dark:text-muted-foreground">{label}</p>
      {has ? (
        <p className={`text-foreground dark:text-white font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      ) : (
        <p className="text-muted-foreground/70 dark:text-muted-foreground/70 text-xs italic">Not published</p>
      )}
    </div>
  )
}

export default function AuctionPinCard({ auction, onClose }: { auction: Auction; onClose: () => void }) {
  const isTaxDeed = (auction.sale_type || auction.auction_type) === 'tax_deed'
  const justValue = auction.market_value ?? auction.assessed_value ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card dark:bg-card border border-border dark:border-border rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground dark:text-white">
              {auction.property_address || 'No Address'}
            </h2>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {formatCountyLabel(auction.county)} County
              {auction.case_number ? <> &middot; {auction.case_number}</> : null}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Type</p>
            <p className={`font-medium ${auction.auction_type === 'foreclosure' ? 'text-primary' : 'text-foreground'}`}>
              {auction.auction_type === 'foreclosure' ? 'Foreclosure' : 'Tax Deed'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Auction Date</p>
            <p className="text-foreground dark:text-white font-medium tabular">
              {auction.auction_date
                ? new Date(auction.auction_date + 'T00:00:00').toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Assessed Value</p>
            <p className="text-foreground dark:text-white font-medium tabular">
              {justValue

import { formatCountyLabel } from '@/lib/counties'
import type { Auction } from '@/types/auctions'

/**
 * The one detail card every auction pin opens, whichever surface the pin was
 * on: /radar (map, table, sidebar), /maps and the homepage map. Extracted
 * from AuctionsLayout's selected-auction modal 2026-09-18, when the same
 * card had to serve the homepage and /maps pins too (owner decision: "The
 * pin from the home page should give this minimum data as well for each
 * property").
 *
 * Missingness is labelled, never filled: a field the county source has not
 * published renders "Not published", not a blank and never an invented
 * value. Parties are auction-type-appropriate - plaintiff/defendant are
 * foreclosure concepts, so a tax deed shows its certificate number and
 * owner instead of two permanently empty party fields. (There is no
 * defendant column on multi_county_auctions at all; the old card rendered
 * it as an em-dash on every row.)
 */

function Field({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  const has = value != null && value !== ''
  return (
    <div>
      <p className="text-muted-foreground dark:text-muted-foreground">{label}</p>
      {has ? (
        <p className={`text-foreground dark:text-white font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      ) : (
        <p className="text-muted-foreground/70 dark:text-muted-foreground/70 text-xs italic">Not published</p>
      )}
    </div>
  )
}

export default function AuctionPinCard({ auction, onClose }: { auction: Auction; onClose: () => void }) {
  const isTaxDeed = (auction.sale_type || auction.auction_type) === 'tax_deed'
  const justValue = auction.market_value ?? auction.assessed_value ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card dark:bg-card border border-border dark:border-border rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground dark:text-white">
              {auction.property_address || 'No Address'}
            </h2>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">
              {formatCountyLabel(auction.county)} County
              {auction.case_number ? <> &middot; {auction.case_number}</> : null}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Type</p>
            <p className={`font-medium ${auction.auction_type === 'foreclosure' ? 'text-primary' : 'text-foreground'}`}>
              {auction.auction_type === 'foreclosure' ? 'Foreclosure' : 'Tax Deed'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Auction Date</p>
            <p className="text-foreground dark:text-white font-medium tabular">
              {auction.auction_date
                ? new Date(auction.auction_date + 'T00:00:00').toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground dark:text-muted-foreground">Assessed Value</p>
            <p className="text-foreground dark:text-white font-medium tabular">
