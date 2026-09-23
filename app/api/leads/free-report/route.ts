import { NextRequest, NextResponse } from 'next/server'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { SAMPLE_REPORT_PATH } from '@/lib/analytics/funnel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/leads/free-report - the free-report popup's email capture.
 *
 * Writes into the SAME lead list the Worker's /free-report form uses:
 * lead_profiles via the upsert_lead_full RPC (SECURITY DEFINER, EXECUTE granted
 * to anon - cli-anything-biddeed supabase/migrations/20260807_upsert_lead_full_rpc.sql),
 * tagged source='popup_free_report' so popup leads are countable on their own.
 *
 * Consent: the email is given in exchange for the free report. Marketing email
 * consent (email_consent / marketing_consent) is ONLY set when the visitor
 * ticks the optional, unticked-by-default digest box. SMS consent is never set
 * here. The daily digest and every other sender already gate on those columns
 * (docs/gtm/CONSENT_AUDIT_2026-09-07.md), so a popup lead who did not tick the
 * box is never mailed.
 *
 * The visitor gets the report whether or not the write succeeds - a lead-list
 * hiccup must not turn the promised free report into an error. `stored` tells
 * the client which happened so the funnel counts only real captures.
 */

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/

export async function POST(request: NextRequest) {
  let body: { email?: unknown; digest_opt_in?: unknown; website?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email.' }, { status: 400 })
  }

  // Honeypot: a hidden field real visitors never see. Bots that fill every
  // input get the same success response but nothing is written.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true, stored: false, report_url: SAMPLE_REPORT_PATH })
  }

  const digestOptIn = body.digest_opt_in === true
  let stored = false
  try {
    const supabase = getRetryingSupabaseClient()
    const { error } = await supabase.rpc('upsert_lead_full', {
      p_email: email,
      p_name: null,
      p_phone: null,
      p_county: null,
      p_email_consent: digestOptIn,
      p_sms_consent: false,
      p_source: 'popup_free_report',
    })
    if (error) {
      console.error(JSON.stringify({ level: 'warn', scope: 'leads.free-report', detail: error.message }))
    } else {
      stored = true
    }
  } catch (err) {
    console.error(JSON.stringify({ level: 'warn', scope: 'leads.free-report', detail: (err as Error).message }))
  }

  return NextResponse.json({ ok: true, stored, report_url: SAMPLE_REPORT_PATH })
}
