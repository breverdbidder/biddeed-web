/**
 * Types and copy shared by the /account/developers page, its client panel and
 * the /api/developer/keys routes. No server-only imports here: the client
 * component imports this file.
 */
export const MCP_ENDPOINT = 'https://mcp.biddeed.ai/mcp'
/** biddeed-mcp auth.js caches a validated key for 5 minutes. */
export const REVOKE_PROPAGATION_MINUTES = 5

export type KeyStatus = 'active' | 'revoked' | 'expired'

export type DeveloperKey = {
  key_id: string
  key_prefix: string
  tier: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
  expires_at: string | null
  status: KeyStatus
}

export type BlockReason = 'no_plan' | 'plan_expired' | 'rate_limited'

export type KeyListing = {
  customer: boolean
  tier: string | null
  can_create: boolean
  block_reason: BlockReason | null
  keys: DeveloperKey[]
}

export type CreatedKey = {
  key: string
  key_id: string
  key_prefix: string
  tier: string
  expires_at: string | null
  created_at: string
  replaced_key_ids: string[]
}

export const EMPTY_LISTING: KeyListing = { customer: false, tier: null, can_create: false, block_reason: 'no_plan', keys: [] }

export const BLOCK_MESSAGES: Record<BlockReason, string> = {
  no_plan: 'API keys come with an API plan. Your account does not have one yet.',
  plan_expired: 'Your API plan has ended, so a new key would not work. Renew to get a working key.',
  rate_limited: 'You have created 10 keys in the last 24 hours. You can create another one tomorrow.',
}
