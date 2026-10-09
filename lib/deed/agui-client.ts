/**
 * Browser side of the AG-UI stream (issue #20664). A hand-rolled SSE reader:
 * the events are the open @ag-ui/core shapes, but the client needs only their
 * `type` strings, so it imports nothing at runtime (no zod in the page bundle).
 */
export interface AguiEvent {
  type: string
  [k: string]: unknown
}

export async function readAguiStream(body: ReadableStream<Uint8Array>, onEvent: (e: AguiEvent) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const frames = buf.split('\n\n')
    buf = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      try {
        const evt = JSON.parse(line.slice(6)) as AguiEvent
        if (evt && typeof evt.type === 'string') onEvent(evt)
      } catch {
        /* a malformed frame is skipped, never shown as an answer */
      }
    }
  }
}

export type LifecycleCard =
  | { kind: 'quote'; name: string; amount_usd: number; interval?: string; one_time?: boolean }
  | { kind: 'confirm'; ref: string; readback: string; amount_usd: number; expires_at?: string; action: string; state: 'idle' | 'working' | 'done' | 'failed' }
  | { kind: 'checkout'; url: string; amount_usd?: number; product?: string }
  | { kind: 'link'; url: string; label: string }
  | { kind: 'account'; plan: string; billing_on_file: boolean; credits_balance: number }
  | { kind: 'invoices'; invoices: Array<{ number: string | null; date: string | null; amount_usd: number; status: string; url: string | null }> }

export interface LifecycleState {
  tools: Array<{ id: string; label: string; done: boolean }>
  cards: LifecycleCard[]
  text: string
  error?: string
}

export const emptyLifecycle = (): LifecycleState => ({ tools: [], cards: [], text: '' })

/** Folds one AG-UI event into the turn's lifecycle state. Pure. */
export function foldEvent(prev: LifecycleState, e: AguiEvent): LifecycleState {
  switch (e.type) {
    case 'TOOL_CALL_START':
      return { ...prev, tools: [...prev.tools, { id: String(e.toolCallId), label: String(e.toolCallName), done: false }] }
    case 'TOOL_CALL_RESULT':
      return { ...prev, tools: prev.tools.map((t) => (t.id === e.toolCallId ? { ...t, done: true } : t)) }
    case 'TEXT_MESSAGE_CONTENT':
      return { ...prev, text: prev.text + String(e.delta ?? '') }
    case 'RUN_ERROR':
      return { ...prev, error: String(e.message ?? 'Something went wrong.') }
    case 'CUSTOM': {
      const v = (e.value ?? {}) as Record<string, any>
      switch (e.name) {
        case 'deed.quote_card':
          return { ...prev, cards: [...prev.cards, { kind: 'quote', name: v.name, amount_usd: v.amount_usd, interval: v.interval, one_time: v.one_time }] }
        case 'deed.confirm_card':
          return { ...prev, cards: [...prev.cards, { kind: 'confirm', ref: v.ref, readback: v.readback, amount_usd: v.amount_usd, expires_at: v.expires_at, action: v.action, state: 'idle' }] }
        case 'deed.checkout_card':
          return { ...prev, cards: [...prev.cards, { kind: 'checkout', url: v.url, amount_usd: v.amount_usd, product: v.product }] }
        case 'deed.link_card':
          return { ...prev, cards: [...prev.cards, { kind: 'link', url: v.url, label: v.label }] }
        case 'deed.account_card':
          return { ...prev, cards: [...prev.cards, { kind: 'account', plan: v.plan, billing_on_file: v.billing_on_file, credits_balance: v.credits_balance }] }
        case 'deed.invoices_card':
          return { ...prev, cards: [...prev.cards, { kind: 'invoices', invoices: v.invoices ?? [] }] }
      }
      return prev
    }
    default:
      return prev
  }
}
