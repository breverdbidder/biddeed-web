import { NextRequest } from 'next/server'

import { requireDeedContext } from '@/lib/deed/server'
import { UUID_RE, isJson, isSameOrigin, skillsJson } from '@/lib/skills/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 *   PATCH  /api/deed/skills/:id   {enabled?, pinned?} for a system skill or one of the caller's own
 *   DELETE /api/deed/skills/:id   delete one of the caller's own skills (system skills cannot be deleted)
 *
 * Both RPCs scope by the Clerk id, so another account's skill id is a 404.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return skillsJson({ error: 'Cross-site request refused.' }, 403)
  if (!isJson(request)) return skillsJson({ error: 'Send a JSON body.' }, 415)
  const id = (await context.params).id
  if (!UUID_RE.test(id)) return skillsJson({ error: 'Skill not found.' }, 404)
  const auth = await requireDeedContext()
  if (!auth.ok) return skillsJson({ error: 'Sign in to change your skills.' }, 401)
  const { userId, supabase } = auth.ctx

  const body = (await request.json().catch(() => null)) as { enabled?: unknown; pinned?: unknown } | null
  const enabled = typeof body?.enabled === 'boolean' ? body.enabled : null
  const pinned = typeof body?.pinned === 'boolean' ? body.pinned : null
  if (enabled === null && pinned === null) return skillsJson({ error: 'Nothing to change.' }, 400)

  const { data, error } = await supabase.rpc('biddeed_skill_set_pref', {
    p_clerk_user_id: userId,
    p_skill_id: id,
    p_enabled: enabled,
    p_pinned: pinned,
  })
  if (error || !data || typeof data !== 'object') return skillsJson({ error: 'Could not update the skill. Try again.' }, 502)
  if ((data as { error?: string }).error) return skillsJson({ error: 'Skill not found.' }, 404)
  return skillsJson({ ok: true })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return skillsJson({ error: 'Cross-site request refused.' }, 403)
  const id = (await context.params).id
  if (!UUID_RE.test(id)) return skillsJson({ error: 'Skill not found.' }, 404)
  const auth = await requireDeedContext()
  if (!auth.ok) return skillsJson({ error: 'Sign in to change your skills.' }, 401)
  const { userId, supabase } = auth.ctx

  const { data, error } = await supabase.rpc('biddeed_skill_delete', { p_clerk_user_id: userId, p_skill_id: id })
  if (error || !data || typeof data !== 'object') return skillsJson({ error: 'Could not delete the skill. Try again.' }, 502)
  if ((data as { error?: string }).error) return skillsJson({ error: 'Skill not found.' }, 404)
  return skillsJson({ deleted: true })
}
