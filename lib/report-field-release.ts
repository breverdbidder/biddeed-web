import policy from '@/config/report-field-release.v1.json'

export type ReportFieldState = 'live' | 'beta' | 'withheld' | 'unavailable' | 'needs_review'
export type ModelField = 'third_party_purchase_probability' | 'predicted_final_sale_price' | 'signals_max_bid'
export type SourceBackedInput = {
  value: unknown
  sourceReference?: string | null
  effectiveAt?: string | null
  retrievedAt?: string | null
  exactMatch: boolean
  valid: boolean
  conflict?: boolean
}
export type ReleasedField = {
  policyVersion: string
  state: ReportFieldState
  value: unknown | null
  label: string
  sourceReference?: string
  asOf?: string
}

export const REPORT_FIELD_RELEASE_POLICY = policy
export const REPORT_SNAPSHOT_METADATA_KEYS = [
  'report_id',
  'generated_at',
  'policy_version',
  'snapshot_sha256',
  'source_references',
  'field_states',
] as const

export function releaseSourceBackedField(input: SourceBackedInput): ReleasedField {
  const base = { policyVersion: policy.policy_version, value: null as unknown | null }
  if (input.conflict) return { ...base, state: 'needs_review', label: 'Needs review' }
  if (input.value == null || input.value === '') return { ...base, state: 'unavailable', label: 'Unavailable' }
  const asOf = input.effectiveAt || input.retrievedAt
  if (!input.exactMatch || !input.valid || !input.sourceReference || !asOf) {
    return { ...base, state: 'withheld', label: 'Withheld - source verification incomplete' }
  }
  return {
    policyVersion: policy.policy_version,
    state: 'live',
    value: input.value,
    label: 'Source-backed fact',
    sourceReference: input.sourceReference,
    asOf,
  }
}

export function releaseModelField(field: ModelField, _rawValue: unknown): ReleasedField {
  const rule = policy.fields[field]
  if (!rule.public_value_enabled || rule.state !== 'beta') {
    return { policyVersion: policy.policy_version, state: 'withheld', value: null, label: rule.label }
  }
  // V1 deliberately has no executable beta path. A later policy version must
  // add a validated model registry before this branch can return a number.
  return { policyVersion: policy.policy_version, state: 'withheld', value: null, label: 'Withheld - validation in progress' }
}
