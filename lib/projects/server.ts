/**
 * Ownership boundary for the construction-management RPCs (issue #20106).
 *
 * cm_budget_detail / cm_line_upsert / cm_line_delete / cm_actual_log /
 * cm_scope_detail / cm_scope_bid are SECURITY DEFINER and trust the id they
 * are given — none of them re-check who is calling. Same shape as
 * d4d_stop_update (lib/tier/server.ts header, app/api/d4d/stops/[id]/route.ts):
 * this app is the only authorization boundary between "Pro Plus" and "can
 * read or edit any other Pro Plus user's budget by guessing a UUID", so every
 * route that takes a budget/line/scope id resolves it back to cm_budgets.owner_email
 * and compares against the caller's own email before touching the RPC.
 *
 * Ownership is by owner_email, not clerk_user_id: cm_budget_create only sets
 * clerk_user_id when Clerk supplies one, and seeded/imported budgets (e.g. the
 * demo row from cm_budgets_list) carry a null clerk_user_id with a real
 * owner_email — the same dimension cm_budgets_list itself is queried by.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

function normalize(email: string | null): string {
  return (email ?? '').trim().toLowerCase()
}

export async function ownerEmailForBudget(supabase: SupabaseClient, budgetId: string): Promise<string | null> {
  const { data, error } = await supabase.from('cm_budgets').select('owner_email').eq('id', budgetId).maybeSingle()
  if (error || !data) return null
  return data.owner_email ?? null
}

export async function projectIdForBudget(supabase: SupabaseClient, budgetId: string): Promise<string | null> {
  const { data, error } = await supabase.from('cm_budgets').select('project_id').eq('id', budgetId).maybeSingle()
  if (error || !data) return null
  return data.project_id ?? null
}

export async function budgetIdForLine(supabase: SupabaseClient, lineId: string): Promise<string | null> {
  const { data, error } = await supabase.from('cm_budget_lines').select('budget_id').eq('id', lineId).maybeSingle()
  if (error || !data) return null
  return data.budget_id ?? null
}

export async function budgetIdForScope(supabase: SupabaseClient, scopeId: string): Promise<string | null> {
  const { data, error } = await supabase.from('cm_scopes').select('budget_id').eq('id', scopeId).maybeSingle()
  if (error || !data) return null
  return data.budget_id ?? null
}

/** True only when `budgetId` exists and its owner_email matches the caller's own email. */
export async function callerOwnsBudget(supabase: SupabaseClient, budgetId: string, callerEmail: string | null): Promise<boolean> {
  if (!callerEmail) return false
  const ownerEmail = await ownerEmailForBudget(supabase, budgetId)
  return ownerEmail !== null && normalize(ownerEmail) === normalize(callerEmail)
}
