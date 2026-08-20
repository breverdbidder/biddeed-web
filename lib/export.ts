import type { Auction } from '@/types/auctions'

// 'Defendant' was a header over a column that was blank in every row ever
// exported: `defendant` is not a column on multi_county_auctions and
// GET /api/auctions has never returned it. A CSV that ships an always-blank
// column implies the data exists and is missing for these particular rows.
const CSV_HEADERS = [
  'County', 'Case Number', 'Address', 'Auction Date', 'Type',
  'Plaintiff', 'Just Value', 'Opening Bid', 'Judgment Amount',
  'Year Built', 'Living Area (sqft)', 'Lot Size', 'Owner',
  'Parcel ID', 'Vacant Land',
]

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

function auctionToRow(a: Auction): string[] {
  const justValue = a.market_value ?? a.assessed_value ?? null
  return [
    a.county || '',
    a.case_number || '',
    a.property_address || '',
    a.auction_date || '',
    a.auction_type || '',
    a.plaintiff || '',
    justValue?.toString() || '',
    a.opening_bid?.toString() || '',
    a.judgment_amount?.toString() || '',
    a.year_built?.toString() || '',
    a.living_area_sqft?.toString() || '',
    a.lot_size?.toString() || '',
    a.owner_name || '',
    a.parcel_id || '',
    // is_vacant_land is null (unknown), not false, when property_type is
    // unknown — collapsing that to "No" would assert a fact we don't have.
    a.is_vacant_land == null ? '' : a.is_vacant_land ? 'Yes' : 'No',
  ]
}

export function downloadCSV(auctions: Auction[], filename = 'biddeed-auctions.csv') {
  const rows = auctions.map(a => auctionToRow(a).map(escapeCSV).join(','))
  const csv = [CSV_HEADERS.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
