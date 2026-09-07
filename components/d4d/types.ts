export interface D4DCandidate {
  mca_id: string
  case_number: string
  county: string
  property_address: string | null
  zip: string | null
  latitude: number
  longitude: number
  auction_date: string
  judgment_amount: number | null
  opening_bid: number | null
  assessed_value: number | null
  parity_status: string | null
}

export type FieldStatus = 'pending' | 'vacant' | 'occupied' | 'uncertain' | 'skip' | 'bid' | 'review' | 'd4d_find'

export interface D4DRouteStop {
  id: string
  seq: number
  mca_id: string | null
  case_number: string | null
  county: string
  property_address: string | null
  zip: string | null
  latitude: number
  longitude: number
  auction_date: string | null
  judgment_amount: number | null
  opening_bid: number | null
  assessed_value: number | null
  verdict: string | null
  signal_max_bid: number | null
  field_status: FieldStatus
  field_notes: string | null
  visited_at: string | null
  leg_miles: number | null
}

export interface D4DRouteSummary {
  id: string
  user_id: string
  name: string
  county: string
  status: string
  stop_count: number
  total_distance_miles: number
  estimated_minutes: number
  origin_lat: number | null
  origin_lng: number | null
  auction_date: string | null
  created_at: string
  updated_at: string
}

export interface D4DDiscovery {
  id: string
  route_id: string
  latitude: number
  longitude: number
  address: string | null
  note: string | null
  distress_signals: string[] | null
  created_at: string
}

export interface D4DRouteDetail {
  route: D4DRouteSummary
  stops: D4DRouteStop[]
  discoveries: D4DDiscovery[]
  photo_count: number
}

export const MAX_STOPS = 40
