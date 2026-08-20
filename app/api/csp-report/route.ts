import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * CSP violation sink.
 *
 * WHY THIS EXISTS: the policy built in middleware.ts ends with
 *
 *   report-uri /api/csp-report
 *   report-to  csp-endpoint
 *
 * and `/api/csp-report(.*)` was already allowlisted as public and rate-limited
 * there — but no handler had ever been written in this repo, so every violation
 * report 404'd. That mattered more than it looks: the ElevenLabs widget comment
 * in middleware.ts instructs a future engineer to regenerate its pinned script
 * hashes "from fresh CSP violation reports (check /api/csp-report)". The
 * instructions pointed at a route that could not answer. Measured 2026-08-20.
 *
 * Browsers disagree on the wire format and neither is application/json:
 *   - report-uri  → Content-Type: application/csp-report, body { "csp-report": {...} }
 *   - report-to   → Content-Type: application/reports+json, body [ { type, body } ]
 * Both are accepted here. Anything unparseable is counted, not thrown.
 *
 * Always 204. A reporting endpoint that can fail a page load is worse than no
 * reporting endpoint, and browsers ignore the response body regardless.
 */

/** Directives we already know are noisy and correct; logged at debug, not warn. */
const KNOWN_BENIGN: { directive: string; match: string; note: string }[] = [
  {
    directive: 'font-src',
    match: 'data:application/x-font-ttf',
    note:
      "FullCalendar's icon font is a data: URI and font-src does not allow data:. " +
      'This is the policy working. buttonIcons={false} already replaces the arrows ' +
      'with text buttons, so there is no visual consequence. Do NOT add data: to font-src.',
  },
]

interface Normalised {
  documentUri: string | null
  violatedDirective: string | null
  blockedUri: string | null
  sourceFile: string | null
  lineNumber: number | null
  /** sha256 the browser says would have allowed an inline script. Gold for hash pinning. */
  scriptSample: string | null
}

function normalise(payload: unknown): Normalised[] {
  const out: Normalised[] = []
  const push = (r: Record<string, unknown>) => {
    out.push({
      documentUri: (r['document-uri'] ?? r.documentURL ?? null) as string | null,
      violatedDirective: (r['effective-directive'] ??
        r['violated-directive'] ??
        r.effectiveDirective ??
        null) as string | null,
      blockedUri: (r['blocked-uri'] ?? r.blockedURL ?? null) as string | null,
      sourceFile: (r['source-file'] ?? r.sourceFile ?? null) as string | null,
      lineNumber: (r['line-number'] ?? r.lineNumber ?? null) as number | null,
      scriptSample: (r['script-sample'] ?? r.sample ?? null) as string | null,
    })
  }

  if (Array.isArray(payload)) {
    // report-to: [{ type: 'csp-violation', body: {...} }]
    for (const item of payload) {
      const body = (item as Record<string, unknown>)?.body
      if (body && typeof body === 'object') push(body as Record<string, unknown>)
    }
    return out
  }

  if (payload && typeof payload === 'object') {
    const legacy = (payload as Record<string, unknown>)['csp-report']
    if (legacy && typeof legacy === 'object') {
      push(legacy as Record<string, unknown>)
      return out
    }
    push(payload as Record<string, unknown>)
  }
  return out
}

export async function POST(req: NextRequest) {
  let payload: unknown
  try {
    // Do NOT use req.json() blindly on these content types — parse the text so a
    // malformed body is a counted no-op rather than a 500 in the log noise.
    payload = JSON.parse(await req.text())
  } catch {
    console.warn('[csp-report] unparseable body', {
      contentType: req.headers.get('content-type'),
    })
    return new NextResponse(null, { status: 204 })
  }

  for (const r of normalise(payload)) {
    const benign = KNOWN_BENIGN.find(
      (k) =>
        r.violatedDirective?.startsWith(k.directive) && (r.blockedUri ?? '').includes(k.match)
    )
    const entry = {
      directive: r.violatedDirective,
      blocked: r.blockedUri?.slice(0, 200) ?? null,
      document: r.documentUri,
      source: r.sourceFile ? `${r.sourceFile}:${r.lineNumber ?? '?'}` : null,
      // The sample is what you hash to pin an inline script. Keep it whole.
      sample: r.scriptSample,
    }
    if (benign) console.debug('[csp-report] known-benign', { ...entry, note: benign.note })
    else console.warn('[csp-report] violation', entry)
  }

  return new NextResponse(null, { status: 204 })
}

/** GET exists only so a human can confirm the route is deployed at all. */
export async function GET() {
  return NextResponse.json({ status: 'ok', accepts: ['POST'] })
}
