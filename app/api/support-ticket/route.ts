/**
 * Public support ticket API — biddeed.ai/api/support-ticket
 *
 *   POST  { name, email, category, subject, message, priority?, plan_tier?,
 *           page_url?, company_website? (honeypot) }
 *         -> 201 { ok, ticket_number, status }
 *   GET   ?ticket_number=BD-YYYYMMDD-XXXX&email=...
 *         -> 200 { ok, ticket } | 404
 *
 * Anonymous by design: the form is how a prospect with no account reaches
 * us. When a Clerk session exists its user id is attached server-side
 * (never trusted from the client). Listed in middleware's isPublicRoute so
 * auth.protect() never intercepts it.
 *
 * Notifications (hello@biddeed.ai + customer acknowledgement) are sent by
 * the database trigger on insert, not here — see lib/support/server.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  PLAN_TIERS,
  PUBLIC_TICKET_FIELDS,
  TICKET_CATEGORIES,
  TICKET_NUMBER_RE,
  TICKET_PRIORITIES,
  clampText,
  clientIp,
  isValidEmail,
  optionalClerkUserId,
  serviceClient,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/support/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CREATE_LIMIT = { limit: 5, windowSeconds: 600 } // 5 tickets / 10 min / IP
const LOOKUP_LIMIT = { limit: 30, windowSeconds: 600 }
const NO_STORE = { 'Cache-Control': 'no-store' }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

function looksLikeSpam(body: Record<string, unknown>): boolean {
  // Honeypot: real browsers never fill the visually hidden "company_website".
  if (typeof body.company_website === 'string' && body.company_website.trim() !== '') return true
  const message = typeof body.message === 'string' ? body.message : ''
  if (message.length > 20000) return true
  const links = (message.match(/https?:\/\//gi) || []).length
  return links > 8
}

function fakeTicketNumber(): string {
  return 'BD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-0000'
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const rate = await checkRateLimit(`support:create:${ip}`, CREATE_LIMIT)
  if (!rate.allowed) {
    return json({ error: 'Too many requests. Please try again in a few minutes, or email hello@biddeed.ai.' }, 429)
  }

  const supabase = serviceClient()
  if (!supabase) return json({ error: 'Support is temporarily unavailable. Email hello@biddeed.ai.' }, 500)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return json({ error: 'Invalid JSON body.' }, 400)

  // Silent success for bots: never tip off a honeypot hit, never store it.
  if (looksLikeSpam(body)) {
    return json({ ok: true, ticket_number: fakeTicketNumber(), status: 'open' }, 201)
  }

  const name = clampText(body.name, 120)
  const email = clampText(body.email, 254).toLowerCase()
  const category = clampText(body.category, 40) as TicketCategory
  const subject = clampText(body.subject, 200)
  const message = clampText(body.message, 10000)
  const requestedPriority = (clampText(body.priority, 20) || 'normal') as TicketPriority
  const planTier = clampText(body.plan_tier, 40)
  const pageUrl = clampText(body.page_url, 500)

  const missing = [
    !name && 'name',
    !isValidEmail(email) && 'email',
    !TICKET_CATEGORIES.includes(category) && 'category',
    !subject && 'subject',
    message.length < 10 && 'message',
  ].filter(Boolean)
  if (missing.length > 0) {
    return json({ error: 'Please check the highlighted fields.', invalid: missing, categories: TICKET_CATEGORIES }, 400)
  }
  if (!TICKET_PRIORITIES.includes(requestedPriority)) return json({ error: 'Invalid priority.' }, 400)
  if (planTier && !(PLAN_TIERS as readonly string[]).includes(planTier)) return json({ error: 'Invalid plan.' }, 400)

  // Security reports jump the queue when the customer left priority at the default.
  const priority: TicketPriority =
    category === 'security' && requestedPriority === 'normal' ? 'high' : requestedPriority

  const clerkUserId = await optionalClerkUserId()

  const row = {
    name,
    email,
    category,
    subject,
    message,
    priority,
    plan_tier: planTier || null,
    page_url: pageUrl || null,
    user_agent: clampText(request.headers.get('user-agent'), 500) || null,
    clerk_user_id: clerkUserId,
    channel: 'web_support_form',
    metadata: {
      source: 'web_support_form',
      cf_ray: request.headers.get('cf-ray'),
      country: request.headers.get('cf-ipcountry'),
      ip,
    },
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert(row)
    .select('ticket_number,status')
    .single()

  if (error || !data) {
    console.error('[support-ticket] insert failed', error?.code, error?.message)
    return json({ error: 'Could not create the ticket. Email hello@biddeed.ai and we will pick it up.' }, 502)
  }

  return json({ ok: true, ticket_number: data.ticket_number, status: data.status }, 201)
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request)
  const rate = await checkRateLimit(`support:lookup:${ip}`, LOOKUP_LIMIT)
  if (!rate.allowed) return json({ error: 'Too many lookups. Please try again shortly.' }, 429)

  const supabase = serviceClient()
  if (!supabase) return json({ error: 'Support is temporarily unavailable.' }, 500)

  const url = new URL(request.url)
  const ticketNumber = (url.searchParams.get('ticket_number') || '').trim().toUpperCase()
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  if (!TICKET_NUMBER_RE.test(ticketNumber) || !isValidEmail(email)) {
    return json({ error: 'A ticket number (BD-YYYYMMDD-XXXX) and the email used on it are required.' }, 400)
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .select(PUBLIC_TICKET_FIELDS)
    .eq('ticket_number', ticketNumber)
    .eq('email', email)
    .maybeSingle()

  if (error) {
    console.error('[support-ticket] lookup failed', error.code, error.message)
    return json({ error: 'Lookup failed. Please try again.' }, 502)
  }
  if (!data) return json({ error: 'No ticket matches that number and email.' }, 404)
  return json({ ok: true, ticket: data })
}
