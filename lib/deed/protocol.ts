/**
 * The wire contract between this app and the Worker's /chat/api, plus the
 * action grammar defined in lib/deed/context.ts.
 *
 * Deliberately framework-free: the proxy route imports it on the server and the
 * chat hook imports it in the browser, and both must agree exactly.
 */

export interface DeedMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Hard limits enforced by the Worker (src/worker.js, POST /chat/api). Exceeding
 * any of them is a 400, not a truncation — so the client trims BEFORE sending
 * rather than discovering the ceiling as an error in front of the user.
 *
 * Measured from the handler on 2026-08-20:
 *   Content-Length  > 20000  -> 413 'Request too large'
 *   messages.length > 20     -> 400 'Too many messages'
 *   sum(content)    > 8000   -> 400 'Messages too long'
 *   role not in {user, assistant} -> 400 'Invalid message role'
 */
export const WORKER_MAX_MESSAGES = 20
export const WORKER_MAX_CHARS = 8000

/**
 * Drops the oldest turns until the payload fits, always keeping the newest
 * message. The newest one is the question actually being asked; if it alone
 * exceeds the budget it is truncated with a visible marker rather than sent as
 * a silent fragment.
 */
export function trimForWorker(messages: DeedMessage[]): DeedMessage[] {
  const kept = messages.slice(-WORKER_MAX_MESSAGES)
  if (kept.length === 0) return kept

  const total = () => kept.reduce((n, m) => n + m.content.length, 0)
  while (kept.length > 1 && total() > WORKER_MAX_CHARS) kept.shift()

  if (kept.length === 1 && kept[0].content.length > WORKER_MAX_CHARS) {
    kept[0] = {
      ...kept[0],
      content: kept[0].content.slice(0, WORKER_MAX_CHARS - 40) + '\n\n[message truncated]',
    }
  }
  return kept
}

/**
 * The Worker injects this marker into the answer text when it has attached a
 * property panel payload. It is a transport detail and must never reach a
 * screen.
 */
export function stripPropertiesMarker(text: string): string {
  return text.replace(/\[PROPERTIES_LOADED:[^\]]*\]/g, '').trimEnd()
}

export type DeedAction =
  | { kind: 'filter_county'; county: string }
  | { kind: 'open_parcel'; auctionId: string }

const ACTION_RE = /\[\[ACTION:(filter_county|open_parcel):([^\]]+)\]\]/g

/**
 * Extracts at most one action directive and returns the text with EVERY
 * directive removed.
 *
 * Two rules from lib/deed/context.ts, both enforced here rather than trusted:
 *  - one action per reply. If the model emits several we take the first and
 *    discard the rest, because executing two navigations from one answer leaves
 *    the user somewhere neither of them described.
 *  - the directive is stripped before display. A `[[ACTION` string that reaches
 *    the DOM is a bug, so stripping is unconditional and independent of whether
 *    the action was understood.
 *
 * A malformed or unknown directive matches nothing here, so it is neither
 * executed nor rendered — it is simply removed by the same regex sweep below.
 */
export function extractAction(text: string): { action: DeedAction | null; display: string } {
  let action: DeedAction | null = null

  for (const m of text.matchAll(ACTION_RE)) {
    if (action) break
    const value = m[2].trim()
    if (!value) continue
    action =
      m[1] === 'filter_county'
        ? { kind: 'filter_county', county: value.toLowerCase().replace(/\s+/g, '_') }
        : { kind: 'open_parcel', auctionId: value }
  }

  // Sweep every bracketed directive, recognised or not.
  const display = stripPropertiesMarker(text.replace(/\[\[ACTION:[^\]]*\]\]/g, '')).trimEnd()
  return { action, display }
}

/**
 * Incremental SSE reader for the Worker's stream.
 *
 * The Worker emits, in this order and interleaved:
 *   ": heartbeat"                     SSE comment, 5s keepalive, ignore
 *   "data: {\"text\":\"…\"}"          token delta
 *   "event: properties\ndata: {…}"    property-panel payload
 *   "data: [DONE]"                    terminator
 *
 * The heartbeat is not decoration: mobile browsers kill an idle SSE connection,
 * and the model can think for longer than that timeout. A parser that treats
 * ": " lines as data will throw on every one of them.
 */
export async function readDeedStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let pendingEvent: string | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const raw of lines) {
      const line = raw.replace(/\r$/, '')
      if (line.startsWith(':')) continue
      if (line.startsWith('event: ')) {
        pendingEvent = line.slice(7).trim()
        continue
      }
      if (!line.startsWith('data: ')) continue

      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      if (pendingEvent === 'properties') {
        // Not rendered by this surface yet: the workspace column beside the
        // thread already shows the same records, from the same RPCs, and a
        // second copy could disagree with it. Swallowed on purpose.
        pendingEvent = null
        continue
      }
      try {
        const evt = JSON.parse(data) as { text?: unknown }
        if (typeof evt.text === 'string' && evt.text) onDelta(evt.text)
      } catch {
        // A partial or malformed frame is skipped, never surfaced as an answer.
      }
    }
  }
}
