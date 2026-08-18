/**
 * Zoning Intelligence — Shared Utilities
 *
 * DOR use codes, zoning category classification, colors, and DIMS parser.
 * Used across table, map, badges, filters, and enrichment endpoints.
 */

/** Florida DOR Use Code descriptions */
export const DOR_USE_CODES: Record<string, string> = {
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

export type ZoningCategory = 'RES' | 'COM' | 'IND' | 'AGR' | 'INST' | 'MISC'

/** Classify a DOR use code into a high-level zoning category */
export function getZoningCategory(dorCode: string | null | undefined): ZoningCategory | null {
  if (!dorCode) return null
  const code = parseInt(dorCode, 10)
  if (isNaN(code)) return null
  if (code <= 9) return 'RES'
  if (code <= 39) return 'COM'
  if (code <= 49) return 'IND'
  if (code <= 69) return 'AGR'
  if (code <= 79) return 'INST'
  return 'MISC'
}

/** Human-readable labels for zoning categories */
export const ZONING_CATEGORY_LABELS: Record<ZoningCategory, string> = {
  RES: 'Residential',
  COM: 'Commercial',
  IND: 'Industrial',
  AGR: 'Agricultural',
  INST: 'Institutional',
  MISC: 'Miscellaneous',
}

/** Badge/map colors for zoning categories */
export const ZONING_CATEGORY_COLORS: Record<ZoningCategory, { bg: string; text: string; hex: string }> = {
  RES: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', hex: '#3B82F6' },
  COM: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', hex: '#8B5CF6' },
  IND: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', hex: '#F97316' },
  AGR: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', hex: '#22C55E' },
  INST: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', hex: '#14B8A6' },
  MISC: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', hex: '#6B7280' },
}

/** Get DOR description for a code */
export function getDorDescription(dorCode: string | null | undefined): string | null {
  if (!dorCode) return null
  const padded = dorCode.padStart(3, '0')
  return DOR_USE_CODES[padded] || `Code ${padded}`
}

/**
 * Parse DIMS (Dimensional Standards) from zone_code string.
 * Many Florida municipalities encode setbacks and density in the zone code
 * or the future_land_use field. This provides basic parsing.
 */
export interface DimensionalStandards {
  minLotSize: string | null
  maxHeight: string | null
  setbacks: string | null
  density: string | null
}

export function parseDimensionalStandards(
  zoneCode: string | null,
  futureLandUse: string | null
): DimensionalStandards | null {
  if (!zoneCode && !futureLandUse) return null

  const zone = (zoneCode || '').toUpperCase()
  const flu = (futureLandUse || '').toUpperCase()

  // Common residential zone patterns
  if (zone.match(/^R-?1|^RE$|^RS$|^SF$|^EU$/i)) {
    return {
      minLotSize: '7,500 sqft (typical)',
      maxHeight: '35 ft / 2.5 stories',
      setbacks: 'Front: 25ft, Side: 7.5ft, Rear: 20ft',
      density: '1-6 du/acre',
    }
  }

  if (zone.match(/^R-?2|^RM$|^MF$/i)) {
    return {
      minLotSize: '5,000 sqft (typical)',
      maxHeight: '45 ft / 3 stories',
      setbacks: 'Front: 25ft, Side: 10ft, Rear: 20ft',
      density: '6-15 du/acre',
    }
  }

  if (zone.match(/^R-?3|^RH$|^MH$/i)) {
    return {
      minLotSize: '3,500 sqft (typical)',
      maxHeight: '60 ft / 5 stories',
      setbacks: 'Front: 25ft, Side: 15ft, Rear: 25ft',
      density: '15-30 du/acre',
    }
  }

  // Commercial patterns
  if (zone.match(/^C-?1|^BU-?1|^CN$|^NC$/i)) {
    return {
      minLotSize: '5,000 sqft (typical)',
      maxHeight: '35 ft',
      setbacks: 'Front: 25ft, Side: 0-10ft, Rear: 15ft',
      density: 'N/A (commercial)',
    }
  }

  if (zone.match(/^C-?2|^BU-?2|^GC$|^CC$/i)) {
    return {
      minLotSize: '10,000 sqft (typical)',
      maxHeight: '45-60 ft',
      setbacks: 'Front: 25ft, Side: 0-15ft, Rear: 20ft',
      density: 'N/A (commercial)',
    }
  }

  // Industrial patterns
  if (zone.match(/^I-?1|^M-?1|^LI$/i)) {
    return {
      minLotSize: '20,000 sqft (typical)',
      maxHeight: '45 ft',
      setbacks: 'Front: 30ft, Side: 15ft, Rear: 25ft',
      density: 'N/A (industrial)',
    }
  }

  // Agricultural
  if (zone.match(/^A-?1|^AG$|^AU$/i)) {
    return {
      minLotSize: '5 acres (typical)',
      maxHeight: '35 ft',
      setbacks: 'Front: 50ft, Side: 25ft, Rear: 50ft',
      density: '1 du/5 acres',
    }
  }

  return null
}
