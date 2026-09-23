import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { parseWatchInput, publicWatch, requireAlertContext } from '@/lib/alerts/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const selectFields = 'id,case_number,county,alert_types,max_bid,status,created_at'

// CP-5: the notifier emails notify_email. Take it ONLY from the verified Clerk session
// (never from the request body), same trust model as customer_id (D10).
async function verifiedEmail(): Promise<string | null> {
  try {
    const user = await currentUser()
    const primary = user?.primaryEmailAddress
    return primary && primary.verification?.status === 'verified' ? primary.emailAddress : null
  } catch {
    return null
  }
}

export async function GET() {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const { data, error } = await context.supabase.from('auction_watches').select(selectFields).eq('customer_id', context.userId).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load alerts.' }, { status: 502 })
  return NextResponse.json({ watches: (data ?? []).map((row) => publicWatch(row as Record<string, unknown>)) })
}

export async function POST(request: NextRequest) {
  const context = await requireAlertContext()
  if (context.error || !context.supabase || !context.userId) return NextResponse.json({ error: context.error }, { status: 401 })
  const input = parseWatchInput(await request.json().catch(() => null))
  if (!input) return NextResponse.json({ error: 'Invalid alert details.' }, { status: 400 })
  const idempotencyKey = request.headers.get('idempotency-key')?.trim()
  if (!idempotencyKey || idempotencyKey.length > 120) return NextResponse.json({ error: 'Missing idempotency key.' }, { status: 400 })
  const { data: existing } = await context.supabase.from('auction_watches').select(selectFields).eq('customer_id', context.userId).eq('case_number', input.case_number).eq('county', input.county).eq('status', 'active').limit(1)
  const notifyEmail = await verifiedEmail()
  if (existing?.[0]) {
    if (notifyEmail) await context.supabase.from('auction_watches').update({ notify_email: notifyEmail }).eq('id', (existing[0] as { id: number }).id).is('notify_email', null)
    return NextResponse.json({ watch: publicWatch(existing[0] as Record<string, unknown>), replayed: true })
  }
  const { data, error } = await context.supabase.from('auction_watches').insert({ case_number: input.case_number, county: input.county, customer_id: context.userId, notify_email: notifyEmail, alert_types: input.alert_types, max_bid: input.max_bid, status: 'active' }).select(selectFields).single()
  if (error) return NextResponse.json({ error: 'Unable to save this alert.' }, { status: 502 })
  return NextResponse.json({ watch: publicWatch(data as Record<string, unknown>) }, { status: 201 })
}
