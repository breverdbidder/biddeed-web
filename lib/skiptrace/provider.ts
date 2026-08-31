import { randomUUID } from 'node:crypto'

export type SkipTraceRequest = {
  subject_type: 'property' | 'entity'
  subject_id: string
  purpose: string
  consent_version: string
  requested_fields: Array<'name' | 'phone' | 'email' | 'mailing_address'>
}

export type NormalizedSkipTraceResult = {
  request_id: string
  subject: { type: SkipTraceRequest['subject_type']; id: string }
  matches: Array<{ name: string | null; phones: Array<{ value: string; type: string; confidence: number }>; emails: Array<{ value: string; confidence: number }>; mailing_address: string | null; source: string; provider_record_id: string | null; retrieved_at: string; retention_until: string }>
  warnings: string[]
  disclaimer: string
}

const FIELDS = new Set(['name', 'phone', 'email', 'mailing_address'])

export function parseSkipTraceRequest(value: unknown): SkipTraceRequest | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  const subjectType = body.subject_type
  const subjectId = typeof body.subject_id === 'string' ? body.subject_id.trim() : ''
  const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''
  const consent = typeof body.consent_version === 'string' ? body.consent_version.trim() : ''
  const requested = Array.isArray(body.requested_fields) ? body.requested_fields.filter((field): field is SkipTraceRequest['requested_fields'][number] => typeof field === 'string' && FIELDS.has(field)) : []
  if ((subjectType !== 'property' && subjectType !== 'entity') || !/^[A-Za-z0-9:_-]{3,160}$/.test(subjectId) || !purpose || purpose.length > 200 || !consent || consent.length > 80 || !requested.length) return null
  return { subject_type: subjectType, subject_id: subjectId, purpose, consent_version: consent, requested_fields: requested }
}

export function skipTraceProviderEnabled() {
  return process.env.SKIPTRACE_PROVIDER_ENABLED === 'true' && Boolean(process.env.SKIPTRACE_PROVIDER_API_KEY)
}

export async function lookupSkipTrace(input: SkipTraceRequest): Promise<NormalizedSkipTraceResult> {
  const requestId = randomUUID()
  if (!skipTraceProviderEnabled()) throw new Error('SKIPTRACE_PROVIDER_NOT_CONFIGURED')
  // Provider invocation is intentionally isolated behind this boundary. No provider
  // is selected until legal, permissible-purpose, deletion, and DPA gates pass.
  throw new Error(`SKIPTRACE_PROVIDER_ADAPTER_PENDING:${requestId}`)
}
