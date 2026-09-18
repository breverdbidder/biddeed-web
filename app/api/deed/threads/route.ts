import { NextRequest, NextResponse } from 'next/server'

import { PROJECT_ID_RE } from '@/lib/deed/projects'
import { MAX_TITLE, MAX_TURNS, MAX_TURNS_BYTES, THREAD_ID_RE, dbErrorResponse, requireDeedContext } from '@/lib/deed/server'
import type { ThreadTurn } from '@/lib/deed/threads'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Deed threads for a signed-in customer (PARITY CP-3).
 *
 *   GET  /api/deed/threads          the 30 most recent — id, title, updated_at, project_id
 *   GET  /api/deed/threads?q=text   full-text search over title + turns (same shape)
 *   PUT  /api/deed/threads          upsert one thread the client owns (its own id)
 *
 * Every row is written with, and every read is filtered by, the Clerk `sub`
 * from requireDeedContext(). There is no route that lists across owners.
 */

const LIST_FIELDS = 'id,title,updated_at,project_id'
const LIST_LIMIT = 30

interface ListRow {
  id: string
  title: string
  updated_at: string
  project_id: string | null
}

function cleanTurn(t: unknown): ThreadTurn | null {
  if (!t || typeof t !== 'object') return null
  const x = t as Record<string, unknown>
  if (typeof x.id !== 'string' || (x.role !== 'user' && x.role !== 'assistant') || typeof x.content !== 'string') return null
  const turn: ThreadTurn = {
    id: x.id.slice(0, 40),
    role: x.role,
    content: x.content,
    createdAt: typeof x.createdAt === 'number' ? x.createdAt : Date.now(),
  }
  if (typeof x.attachmentLabel === 'string') turn.attachmentLabel = x.attachmentLabel.slice(0, 255)
  if (typeof x.error === 'string') turn.error = x.error.slice(0, 500)
  if (Array.isArray(x.cited)) turn.cited = x.cited.filter((c): c is string => typeof c === 'string').map((c) => c.slice(0, 255)).slice(0, 20)
  if (x.action && typeof x.action === 'object') turn.action = x.action as ThreadTurn['action']
  if (x.cards && typeof x.cards === 'object') {
    // Card rows are re-fetched on reopen (useDeedThread.refreshCards); keep
    // only the intent so the grid can be rebuilt, never stale sale rows.
    const cards = x.cards as { intent?: unknown }
    if (cards.intent && typeof cards.intent === 'object') {
      turn.cards = { intent: cards.intent as NonNullable<ThreadTurn['cards']>['intent'], rows: [], total: null, loading: false }
    }
  }
  return turn
}

export async function GET(req: NextRequest) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 120)
  // ?project=<id> narrows to one project's chats (CP-4, S4); anything that is
  // not a well-formed id reads as "no filter" rather than an error.
  const project = req.nextUrl.searchParams.get('project') || ''
  const projectFilter = PROJECT_ID_RE.test(project) ? project : null
  let query = supabase.from('deed_threads').select(LIST_FIELDS).eq('owner_user_id', userId).order('updated_at', { ascending: false }).limit(LIST_LIMIT)
  if (q.length >= 2) {
    // websearch_to_tsquery syntax: plain words, quoted phrases, -negation.
    query = supabase
      .from('deed_threads')
      .select(LIST_FIELDS)
      .eq('owner_user_id', userId)
      .textSearch('search_text', q, { type: 'websearch', config: 'english' })
      .order('updated_at', { ascending: false })
      .limit(LIST_LIMIT)
  }
  if (projectFilter) query = query.eq('project_id', projectFilter)
  const { data, error } = await query
  if (error) return dbErrorResponse(error, 'Unable to load your chats.')
  return NextResponse.json({ threads: (data ?? []) as ListRow[], query: q || null })
}

export async function PUT(req: NextRequest) {
  const auth = await requireDeedContext()
  if (!auth.ok) return auth.response
  const { userId, supabase } = auth.ctx

  let body: { id?: unknown; title?: unknown; turns?: unknown; project_id?: unknown; worker_conversation_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || !THREAD_ID_RE.test(body.id)) return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 })
  if (!Array.isArray(body.turns) || body.turns.length > MAX_TURNS) return NextResponse.json({ error: 'Invalid turns' }, { status: 400 })
  const turns = body.turns.map(cleanTurn).filter((t): t is ThreadTurn => t !== null)
  if (turns.length === 0) return NextResponse.json({ error: 'A thread needs at least one turn' }, { status: 400 })
  const turnsJson = JSON.stringify(turns)
  if (turnsJson.length > MAX_TURNS_BYTES) return NextResponse.json({ error: 'Thread too large' }, { status: 413 })

  const title = (typeof body.title === 'string' ? body.title : '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || 'New conversation'
  const project_id = typeof body.project_id === 'string' && PROJECT_ID_RE.test(body.project_id) ? body.project_id : null
  const worker_conversation_id =
    typeof body.worker_conversation_id === 'string' && body.worker_conversation_id.length <= 64 ? body.worker_conversation_id : null
  const search_text = turns
    .map((t) => t.content)
    .join('\n')
    .slice(0, 100_000)

  // Upsert on the primary key, but never across owners: a second customer
  // guessing an id gets a conflict on the owner filter, not a takeover.
  const { data: existing, error: readError } = await supabase.from('deed_threads').select('id,owner_user_id').eq('id', body.id).maybeSingle()
  if (readError) return dbErrorResponse(readError, 'Unable to save this chat.')
  if (existing && existing.owner_user_id !== userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = { id: body.id, owner_user_id: userId, title, project_id, worker_conversation_id, turns, search_text, updated_at: new Date().toISOString() }
  const { data, error } = await supabase.from('deed_threads').upsert(row, { onConflict: 'id' }).select('id,title,updated_at,project_id').single()
  if (error) return dbErrorResponse(error, 'Unable to save this chat.')
  return NextResponse.json({ thread: data })
}
