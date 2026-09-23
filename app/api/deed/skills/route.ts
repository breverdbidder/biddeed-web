import { NextRequest } from 'next/server'

import { requireDeedContext } from '@/lib/deed/server'
import { parseSkillMd } from '@/lib/skills/parse'
import { isJson, isSameOrigin, skillsJson } from '@/lib/skills/server'
import { SYSTEM_SKILLS, type SkillSummary } from '@/lib/skills/shared'
import { getCallerTierId, tierAtLeast } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Deed Skills library (PARITY CP-6).
 *
 *   GET  /api/deed/skills   the six system skills plus the caller's own, with
 *                           their enable/pin state; signed out, the six system
 *                           skills only (nothing to personalise, nothing to run)
 *   POST /api/deed/skills   save a skill from a SKILL.md: {spec_md}
 */
export async function GET() {
  const auth = await requireDeedContext()
  if (!auth.ok) return skillsJson({ signed_in: false, can_run: false, skills: SYSTEM_SKILLS })
  const { userId, supabase } = auth.ctx
  const [library, tierId] = await Promise.all([
    supabase.rpc('biddeed_skills_library', { p_clerk_user_id: userId }),
    getCallerTierId(),
  ])
  if (library.error || !Array.isArray(library.data)) {
    // Before the migration is applied the library still shows the six skills.
    return skillsJson({ signed_in: true, can_run: false, skills: SYSTEM_SKILLS, unavailable: true })
  }
  return skillsJson({ signed_in: true, can_run: tierAtLeast(tierId, 'investor'), skills: library.data as SkillSummary[] })
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return skillsJson({ error: 'Cross-site request refused.' }, 403)
  if (!isJson(request)) return skillsJson({ error: 'Send a JSON body.' }, 415)
  const auth = await requireDeedContext()
  if (!auth.ok) return skillsJson({ error: 'Sign in to save a skill.' }, 401)
  const { userId, supabase } = auth.ctx

  const body = (await request.json().catch(() => null)) as { spec_md?: unknown } | null
  const specMd = typeof body?.spec_md === 'string' ? body.spec_md : ''
  const parsed = parseSkillMd(specMd)
  if (!parsed.ok) return skillsJson({ error: parsed.error }, 400)

  const { data, error } = await supabase.rpc('biddeed_skill_save', {
    p_clerk_user_id: userId,
    p_name: parsed.skill.name,
    p_description: parsed.skill.description,
    p_instructions: parsed.skill.instructions,
    p_tools: parsed.skill.tools,
    p_spec_md: specMd,
  })
  if (error || !data || typeof data !== 'object') return skillsJson({ error: 'Could not save the skill. Try again.' }, 502)
  const result = data as { id?: string; slug?: string; error?: string; limit?: number }
  if (result.error === 'name_taken') return skillsJson({ error: 'A built-in skill already has that name. Pick another name.' }, 409)
  if (result.error === 'limit') return skillsJson({ error: `You can keep up to ${result.limit ?? 25} skills. Delete one first.` }, 409)
  if (result.error) return skillsJson({ error: 'That SKILL.md did not pass validation. Check the name, description and tools.' }, 400)
  return skillsJson({ saved: { id: result.id, slug: result.slug } }, 201)
}
