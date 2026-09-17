'use client'

import { apiUrl } from '@/lib/api'
import type { Thread, ThreadTurn } from './threads'

/**
 * Server-backed thread store for a signed-in customer (PARITY CP-3) — the
 * client of app/api/deed/threads. Every call is same-origin and carries the
 * Clerk session cookie; the routes answer 401 signed out and 503 while the
 * CP-3 tables are not applied yet. Both read here as "no history", never as
 * an error the customer has to see: the conversation still lives in React
 * state for this tab, exactly as before.
 */

export interface ThreadSummary {
  id: string
  title: string
  updated_at: string
  project_id: string | null
}

async function json<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function listThreads(q?: string): Promise<ThreadSummary[] | null> {
  try {
    const url = q && q.trim().length >= 2 ? `/api/deed/threads?q=${encodeURIComponent(q.trim())}` : '/api/deed/threads'
    const data = await json<{ threads?: ThreadSummary[] }>(await fetch(apiUrl(url), { cache: 'no-store' }))
    return data?.threads ?? null
  } catch {
    return null
  }
}

export async function getThread(id: string): Promise<Thread | null> {
  try {
    const data = await json<{
      thread?: { id: string; title: string; project_id: string | null; worker_conversation_id: string | null; turns: ThreadTurn[]; created_at: string; updated_at: string }
    }>(await fetch(apiUrl(`/api/deed/threads/${encodeURIComponent(id)}`), { cache: 'no-store' }))
    const t = data?.thread
    if (!t || !Array.isArray(t.turns)) return null
    return {
      id: t.id,
      title: t.title,
      createdAt: Date.parse(t.created_at) || Date.now(),
      updatedAt: Date.parse(t.updated_at) || Date.now(),
      turns: t.turns,
      workerConversationId: t.worker_conversation_id ?? undefined,
      projectId: t.project_id,
    }
  } catch {
    return null
  }
}

/** Upserts a settled thread. Pending turns are dropped — they are transport state, not history. */
export async function putThread(thread: Thread): Promise<boolean> {
  try {
    const turns = thread.turns.filter((t) => !t.pending).map((t) => (t.cards ? { ...t, cards: { ...t.cards, rows: [], loading: false } } : t))
    if (turns.length === 0) return false
    const res = await fetch(apiUrl('/api/deed/threads'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: thread.id,
        title: thread.title,
        turns,
        project_id: thread.projectId ?? null,
        worker_conversation_id: thread.workerConversationId ?? null,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteThreadRemote(id: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`/api/deed/threads/${encodeURIComponent(id)}`), { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

/** Same-tab change signal, shared with the local store's subscribers (lib/deed/threads.ts). */
export function notifyThreadsChanged() {
  try {
    window.dispatchEvent(new Event('biddeed:threads'))
  } catch {
    /* ignore */
  }
}
