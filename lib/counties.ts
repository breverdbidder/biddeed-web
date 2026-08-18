/**
 * All 67 Florida counties with slugs and FIPS codes.
 * Source: config/fl_67_county_complete_master.json
 */
export const FL_COUNTIES = [
  { slug: 'alachua', name: 'Alachua', fips: '001' },
  { slug: 'baker', name: 'Baker', fips: '003' },
  { slug: 'bay', name: 'Bay', fips: '005' },
  { slug: 'bradford', name: 'Bradford', fips: '007' },
  { slug: 'brevard', name: 'Brevard', fips: '009' },
  { slug: 'broward', name: 'Broward', fips: '011' },
  { slug: 'calhoun', name: 'Calhoun', fips: '013' },
  { slug: 'charlotte', name: 'Charlotte', fips: '015' },
  { slug: 'citrus', name: 'Citrus', fips: '017' },
  { slug: 'clay', name: 'Clay', fips: '019' },
  { slug: 'collier', name: 'Collier', fips: '021' },
  { slug: 'columbia', name: 'Columbia', fips: '023' },
  { slug: 'desoto', name: 'DeSoto', fips: '027' },
  { slug: 'dixie', name: 'Dixie', fips: '029' },
  { slug: 'duval', name: 'Duval', fips: '031' },
  { slug: 'escambia', name: 'Escambia', fips: '033' },
  { slug: 'flagler', name: 'Flagler', fips: '035' },
  { slug: 'franklin', name: 'Franklin', fips: '037' },
  { slug: 'gadsden', name: 'Gadsden', fips: '039' },
  { slug: 'gilchrist', name: 'Gilchrist', fips: '041' },
  { slug: 'glades', name: 'Glades', fips: '043' },
  { slug: 'gulf', name: 'Gulf', fips: '045' },
  { slug: 'hamilton', name: 'Hamilton', fips: '047' },
  { slug: 'hardee', name: 'Hardee', fips: '049' },
  { slug: 'hendry', name: 'Hendry', fips: '051' },
  { slug: 'hernando', name: 'Hernando', fips: '053' },
  { slug: 'highlands', name: 'Highlands', fips: '055' },
  { slug: 'hillsborough', name: 'Hillsborough', fips: '057' },
  { slug: 'holmes', name: 'Holmes', fips: '059' },
  { slug: 'indian-river', name: 'Indian River', fips: '061' },
  { slug: 'jackson', name: 'Jackson', fips: '063' },
  { slug: 'jefferson', name: 'Jefferson', fips: '065' },
  { slug: 'lafayette', name: 'Lafayette', fips: '067' },
  { slug: 'lake', name: 'Lake', fips: '069' },
  { slug: 'lee', name: 'Lee', fips: '071' },
  { slug: 'leon', name: 'Leon', fips: '073' },
  { slug: 'levy', name: 'Levy', fips: '075' },
  { slug: 'liberty', name: 'Liberty', fips: '077' },
  { slug: 'madison', name: 'Madison', fips: '079' },
  { slug: 'manatee', name: 'Manatee', fips: '081' },
  { slug: 'marion', name: 'Marion', fips: '083' },
  { slug: 'martin', name: 'Martin', fips: '085' },
  { slug: 'miami-dade', name: 'Miami-Dade', fips: '086' },
  { slug: 'monroe', name: 'Monroe', fips: '087' },
  { slug: 'nassau', name: 'Nassau', fips: '089' },
  { slug: 'okaloosa', name: 'Okaloosa', fips: '091' },
  { slug: 'okeechobee', name: 'Okeechobee', fips: '093' },
  { slug: 'orange', name: 'Orange', fips: '095' },
  { slug: 'osceola', name: 'Osceola', fips: '097' },
  { slug: 'palm-beach', name: 'Palm Beach', fips: '099' },
  { slug: 'pasco', name: 'Pasco', fips: '101' },
  { slug: 'pinellas', name: 'Pinellas', fips: '103' },
  { slug: 'polk', name: 'Polk', fips: '105' },
  { slug: 'putnam', name: 'Putnam', fips: '107' },
  { slug: 'santa-rosa', name: 'Santa Rosa', fips: '113' },
  { slug: 'sarasota', name: 'Sarasota', fips: '115' },
  { slug: 'seminole', name: 'Seminole', fips: '117' },
  { slug: 'st-johns', name: 'St. Johns', fips: '109' },
  { slug: 'st-lucie', name: 'St. Lucie', fips: '111' },
  { slug: 'sumter', name: 'Sumter', fips: '119' },
  { slug: 'suwannee', name: 'Suwannee', fips: '121' },
  { slug: 'taylor', name: 'Taylor', fips: '123' },
  { slug: 'union', name: 'Union', fips: '125' },
  { slug: 'volusia', name: 'Volusia', fips: '127' },
  { slug: 'wakulla', name: 'Wakulla', fips: '129' },
  { slug: 'walton', name: 'Walton', fips: '131' },
  { slug: 'washington', name: 'Washington', fips: '133' },
] as const

export type CountySlug = typeof FL_COUNTIES[number]['slug']

export function getCountyBySlug(slug: string) {
  return FL_COUNTIES.find(c => c.slug === slug)
}

export function getCountyByName(name: string) {
  return FL_COUNTIES.find(c => c.name.toLowerCase() === name.toLowerCase())
}

export function formatCountyLabel(raw: string | null | undefined): string {
  if (!raw) return ''
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const known = FL_COUNTIES.find((c) => c.slug === key)
  if (known) return known.name
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
