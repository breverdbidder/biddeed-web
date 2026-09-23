'use client'

import { apiUrl } from '@/lib/api'
import { SYSTEM_SKILLS, type SkillLibrary, type SkillRun } from './shared'

/**
 * Client of /api/deed/skills* (PARITY CP-6). Same-origin; the Clerk session
 * cookie is the identity. Errors come back as the route's own sentence so the
 * customer sees why, never a raw status code.
 */

export type RemoteResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number; upgradeUrl?: string }

async function call<T>(path: string, init?: RequestInit): Promise<RemoteResult<T>> {
  try {
    const res = await fetch(apiUrl(path), { cache: 'no-store', ...init })
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('application/json')) {
      return { ok: false, status: res.status, error: 'Your sign-in has ended. Refresh the page and sign in again.' }
    }
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof body?.error === 'string' ? body.error : 'Something went wrong. Try again.',
        upgradeUrl: typeof body?.upgrade_url === 'string' ? body.upgrade_url : undefined,
      }
    }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, status: 0, error: 'Could not reach BidDeed.AI. Check your connection and try again.' }
  }
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export async function loadSkills(): Promise<SkillLibrary> {
  const r = await call<SkillLibrary>('/api/deed/skills')
  return r.ok ? r.data : { signed_in: false, can_run: false, skills: SYSTEM_SKILLS }
}

export function runSkill(input: { skill: string; county?: string; case_number?: string; auction_id?: string; scope?: string }) {
  return call<{ run: SkillRun }>('/api/deed/skills/run', jsonInit('POST', input))
}

export function saveSkill(specMd: string) {
  return call<{ saved: { id: string; slug: string } }>('/api/deed/skills', jsonInit('POST', { spec_md: specMd }))
}

export function setSkillPref(id: string, pref: { enabled?: boolean; pinned?: boolean }) {
  return call<{ ok: true }>(`/api/deed/skills/${encodeURIComponent(id)}`, jsonInit('PATCH', pref))
}

export function deleteSkill(id: string) {
  return call<{ deleted: true }>(`/api/deed/skills/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
