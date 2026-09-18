/**
 * Tier ordering, client-safe. lib/tier/server.ts resolves the caller's tier
 * from the Supabase SSOT (resolve_user_tier / user_has_capability) and
 * re-exports these; client components (the pin card's lock rendering) import
 * this module directly because server.ts pulls in Clerk server-only APIs.
 * Tier ids are canonical: free, investor, pro, proplus, enterprise - the same
 * ids mcp_subscription_tiers stores and components/deed-home/LandingSections
 * PLANS renders ('Investor' $99/month, 'Pro' $199/month, ...).
 */
export const TIER_RANK: Record<string, number> = { free: 0, investor: 1, pro: 2, proplus: 3, enterprise: 4 }

/**
 * Compares resolved tier rank. Unknown tier ids rank as 'free' so an
 * unrecognized value fails closed.
 */
export function tierAtLeast(tierId: string, minTierId: string): boolean {
  return (TIER_RANK[tierId] ?? 0) >= (TIER_RANK[minTierId] ?? Infinity)
}
