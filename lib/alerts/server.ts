import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const ALERT_TYPES = new Set(['sale_date_change', 'opening_bid_change', 'status_change'])
const CHANNELS = new Set(['email'])

export type WatchInput = {
  case_number: string
  county: string
  max_bid: number | null
  alert_types: string[]
  channels: string[]
  timezone: string
}

export async function requireAlertContext() {
  try {
    const { userId } = await auth()
    if (!userId) return { userId: null, supabase: null, error: 'Authentication required.' }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { userId: null, supabase: null, error: 'Alerts service is not configured.' }
    return {
      userId,
      supabase: createClient(url, key, { auth: { persistSession: false } }),
      error: null,
    }
  } catch {
    return { userId: null, supabase: null, error: 'Authentication required.' }
  }
}

export function parseWatchInput(value: unknown): WatchInput | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const caseNumber = typeof input.case_number === 'string' ? input.case_number.trim().toUpperCase() : ''
  const county = typeof input.county === 'string' ? input.county.trim().toLowerCase() : ''
  const alertTypes = Array.isArray(input.alert_types) ? input.alert_types.filter((item): item is string => typeof item === 'string') : []
  const channels = Array.isArray(input.channels) ? input.channels.filter((item): item is string => typeof item === 'string') : []
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : ''
  const rawBid = input.max_bid
  const maxBid = rawBid === null || rawBid === '' || rawBid === undefined ? null : Number(rawBid)
  if (!caseNumber || caseNumber.length > 120 || !county || county.length > 80 || !timezone || timezone.length > 80) return null
  if (!alertTypes.length || alertTypes.some((item) => !ALERT_TYPES.has(item))) return null
  if (!channels.length || channels.some((item) => !CHANNELS.has(item))) return null
  if (maxBid !== null && (!Number.isFinite(maxBid) || maxBid < 0 || maxBid > 1000000000)) return null
  return { case_number: caseNumber, county, max_bid: maxBid, alert_types: alertTypes, channels, timezone }
}

export function publicWatch(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    case_number: row.case_number,
    county: row.county,
    alert_types: row.alert_types,
    max_bid: row.max_bid,
    channels: ['email'],
    timezone: row.timezone ?? 'America/New_York',
    status: row.status,
    created_at: row.created_at,
  }
}
