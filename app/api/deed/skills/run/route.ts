import { NextRequest } from 'next/server'

import { requireDeedContext } from '@/lib/deed/server'
import { UUID_RE, isJson, isSameOrigin, skillsJson } from '@/lib/skills/server'
import { RUN_ERRORS, SKILL_TOOLS, type SkillRun } from '@/lib/skills/shared'
import { getCallerTierId, tierAtLeast } from '@/lib/tier/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SCOPES = new Set(['cosmetic', 'standard', 'gut'])

/**
 * POST /api/deed/skills/run
 *   {skill: <system slug | skill id>, county, case_number, scope?}  or  {skill, auction_id, scope?}
 *
 * Runs the skill's tools against one auction and returns every tool's facts,
 * rows, source and note. Investor and above; a Free account gets 402 with the
 * upgrade link, the same contract as the auction detail endpoint.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return skillsJson({ error: 'Cross-site request refused.' }, 403)
  if (!isJson(request)) return skillsJson({ error: 'Send a JSON body.' }, 415)
  const auth = await requireDeedContext()
  if (!auth.ok) return skillsJson({ error: RUN_ERRORS.unauthenticated }, 401)
  const { userId, supabase } = auth.ctx

  const tierId = await getCallerTierId()
  if (!tierAtLeast(tierId, 'investor')) {
    return skillsJson(
      {
        error: 'Skills run on Investor and above. Every paid plan includes them.',
        code: 'PAID_TIER_REQUIRED',
        upgrade_url: '/subscribe?tier=investor',
      },
      402
    )
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const skill = typeof body?.skill === 'string' ? body.skill.trim() : ''
  const isSystem = (SKILL_TOOLS as string[]).includes(skill)
  if (!isSystem && !UUID_RE.test(skill)) return skillsJson({ error: RUN_ERRORS.skill_not_found }, 404)

  const inputs: Record<string, string> = {}
  if (typeof body?.auction_id === 'string' && UUID_RE.test(body.auction_id)) {
    inputs.auction_id = body.auction_id
  } else {
    const county = typeof body?.county === 'string' ? body.county.trim().toLowerCase() : ''
    const caseNumber = typeof body?.case_number === 'string' ? body.case_number.trim() : ''
    if (!county || county.length > 40 || !caseNumber || caseNumber.length > 60) {
      return skillsJson({ error: 'Pick a county and enter the case number.' }, 400)
    }
    inputs.county = county
    inputs.case_number = caseNumber
  }
  if (typeof body?.scope === 'string' && SCOPES.has(body.scope)) inputs.scope = body.scope

  // Each run writes one log row, so a blind retry could log twice: retry only
  // when the request never reached Postgres.
  const { data, error } = await supabase.rpc('biddeed_skill_run', {
    p_clerk_user_id: userId,
    p_skill: skill,
    p_inputs: inputs,
  })
  if (error || !data || typeof data !== 'object') {
    return skillsJson({ error: 'The skill could not run just now. Try again in a moment.' }, 502)
  }
  const result = data as Partial<SkillRun> & { error?: string }
  if (result.error) {
    const status = result.error === 'rate_limited' ? 429 : result.error === 'unauthenticated' ? 401 : 404
    return skillsJson({ error: RUN_ERRORS[result.error] ?? 'The skill could not run.', code: result.error }, status)
  }
  return skillsJson({ run: result })
}
