/**
 * Support tickets — server-side helpers shared by the public and admin API
 * routes. Everything here runs on the Worker with the service-role key
 * (already bound to biddeed-web-production by cloudflare-production.yml);
 * nothing in this file is ever imported by client code.
 *
 * Data model: public.support_tickets / public.support_ticket_replies in
 * mocerqjnksmhcjzxrewo. RLS is ON with NO policies on both tables, so the
 * service-role client is the only path in or out — the house rule for any
 * new table (see cli-anything-biddeed sql/support_tickets.sql).
 *
 * Email notifications are NOT sent from here. An AFTER INSERT trigger
 * (support_tickets_notify) posts to Resend through pg_net using the vault's
 * resend_api_key, so this app holds no mail credential and a mail outage
 * can never fail a ticket.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

export const TICKET_CATEGORIES = [
  'billing',
  'account',
  'signal_report',
  'auction_data',
  'zoning',
  'bug',
  'feature',
  'security',
  'other',
] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

/** Canon tiers (mcp_subscription_tiers). "pioneer" is a programme, not a tier. */
export const PLAN_TIERS = ['free', 'investor', 'pro', 'proplus', 'enterprise'] as const

export const TICKET_NUMBER_RE = /^BD-\d{8}-[0-9A-F]{4}$/

/** Fields the public lookup endpoint may return. Never the message body. */
export const PUBLIC_TICKET_FIELDS =
  'ticket_number,status,category,priority,subject,created_at,updated_at,resolved_at'

export const ADMIN_TICKET_FIELDS =
  'id,ticket_number,status,category,priority,subject,message,name,email,clerk_user_id,plan_tier,page_url,user_agent,channel,admin_notes,metadata,created_at,updated_at,resolved_at'

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return getRetryingSupabaseClient(key)
}

export function isValidEmail(value: string): boolean {
  if (value.length < 5 || value.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function clampText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Clerk user id for the current request, or null when signed out or when
 * Clerk is not configured on this deployment. Never throws — a broken auth
 * layer must not block an anonymous support request.
 */
export async function optionalClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth()
    return userId ?? null
  } catch {
    return null
  }
}

export type AdminCheck =
  | { ok: true; via: 'token' | 'clerk'; email: string | null }
  | { ok: false; status: 401 | 403 | 500; error: string }

/**
 * Founder-only gate for the admin inbox. Two independent ways in:
 *
 *  1. `X-Admin-Support-Token` header equal to the ADMIN_SUPPORT_TOKEN secret —
 *     for scripts / a future Deed auto-responder. Optional: when the secret is
 *     not bound, this path is simply closed.
 *  2. A Clerk session whose verified email is listed in public.support_admins
 *     (RLS on, no policies; edited by SQL only). This is the everyday path —
 *     Ariel signs in to biddeed.ai like any customer; no token to paste.
 *
 * Deny by default on any failure.
 */
export async function requireSupportAdmin(request: Request, supabase: SupabaseClient): Promise<AdminCheck> {
  const expected = process.env.ADMIN_SUPPORT_TOKEN
  const presented = request.headers.get('x-admin-support-token')
  if (expected && presented) {
    if (timingSafeEqual(presented, expected)) return { ok: true, via: 'token', email: null }
    return { ok: false, status: 401, error: 'Invalid admin token.' }
  }

  let emails: string[] = []
  try {
    const user = await currentUser()
    if (!user) return { ok: false, status: 401, error: 'Sign in required.' }
    emails = user.emailAddresses
      .filter((e) => e.verification?.status === 'verified' || e.id === user.primaryEmailAddressId)
      .map((e) => e.emailAddress.toLowerCase())
  } catch {
    return { ok: false, status: 401, error: 'Sign in required.' }
  }
  if (emails.length === 0) return { ok: false, status: 403, error: 'No verified email on this account.' }

  const { data, error } = await supabase.from('support_admins').select('email').in('email', emails).limit(1)
  if (error) return { ok: false, status: 500, error: 'Admin check failed.' }
  if (!data || data.length === 0) return { ok: false, status: 403, error: 'This account is not a support admin.' }
  return { ok: true, via: 'clerk', email: data[0].email as string }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
