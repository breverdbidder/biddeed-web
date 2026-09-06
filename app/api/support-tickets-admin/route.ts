/**
 * Founder support inbox API — biddeed.ai/api/support-tickets-admin
 *
 *   GET   ?status=open|in_progress|waiting_on_customer|resolved|closed|all&limit=50
 *         -> { ok, tickets, via }
 *   PATCH { id, status?, priority?, admin_notes? }
 *         -> { ok, ticket }
 *
 * Auth is enforced HERE, not by middleware (this path is in isPublicRoute so
 * a signed-out caller gets a JSON 401 rather than a Clerk redirect). Two ways
 * in — see requireSupportAdmin(): the ADMIN_SUPPORT_TOKEN header, or a Clerk
 * session whose verified email is in public.support_admins.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_TICKET_FIELDS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  requireSupportAdmin,
  serviceClient,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/support/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

export async function GET(request: NextRequest) {
  const supabase = serviceClient()
  if (!supabase) return json({ error: 'Support is not configured on this deployment.' }, 500)
  const admin = await requireSupportAdmin(request, supabase)
  if (!admin.ok) return json({ error: admin.error }, admin.status)

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'open'
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200)
  if (status !== 'all' && !(TICKET_STATUSES as readonly string[]).includes(status)) {
    return json({ error: 'Invalid status filter.' }, 400)
  }

  let query = supabase
    .from('support_tickets')
    .select(ADMIN_TICKET_FIELDS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[support-admin] list failed', error.code, error.message)
    return json({ error: 'Could not load tickets.' }, 502)
  }
  return json({ ok: true, tickets: data ?? [], via: admin.via })
}

export async function PATCH(request: NextRequest) {
  const supabase = serviceClient()
  if (!supabase) return json({ error: 'Support is not configured on this deployment.' }, 500)
  const admin = await requireSupportAdmin(request, supabase)
  if (!admin.ok) return json({ error: admin.error }, admin.status)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'A ticket id is required.' }, 400)

  const patch: Record<string, unknown> = {}
  if (body?.status !== undefined) {
    if (!(TICKET_STATUSES as readonly string[]).includes(String(body.status))) return json({ error: 'Invalid status.' }, 400)
    patch.status = body.status as TicketStatus
  }
  if (body?.priority !== undefined) {
    if (!(TICKET_PRIORITIES as readonly string[]).includes(String(body.priority))) return json({ error: 'Invalid priority.' }, 400)
    patch.priority = body.priority as TicketPriority
  }
  if (typeof body?.admin_notes === 'string') patch.admin_notes = body.admin_notes.slice(0, 5000)
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400)

  // resolved_at / updated_at are set by the BEFORE UPDATE trigger.
  const { data, error } = await supabase
    .from('support_tickets')
    .update(patch)
    .eq('id', id)
    .select(ADMIN_TICKET_FIELDS)
    .maybeSingle()

  if (error) {
    console.error('[support-admin] update failed', error.code, error.message)
    return json({ error: 'Update failed.' }, 502)
  }
  if (!data) return json({ error: 'Ticket not found.' }, 404)
  return json({ ok: true, ticket: data })
}
