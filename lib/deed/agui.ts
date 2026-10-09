import { EventType, type BaseEvent } from '@ag-ui/core'

/**
 * AG-UI transport for Ask Deed (issue #20664, ASKDEED-3).
 *
 * Events are the open AG-UI types from @ag-ui/core, pinned at 1.0.2: one run per
 * turn, the reply as TEXT_MESSAGE_*, each lifecycle tool call as a TOOL_CALL_*
 * group with a customer-facing label, quote / cart / pending-confirm reference as
 * STATE_*, and the cards as CUSTOM events the panel renders. No hosted service,
 * no React kit.
 *
 * PAYLOAD HYGIENE. Nothing below may reach a client event: a card number, a
 * secret or credential, a vendor or internal tool name, or a GitHub issue
 * number. `cleanEvent` enforces it on every event before it is encoded, and a
 * violation becomes RUN_ERROR instead of a leak. The pending-confirm `ref` is the
 * only confirm-related value an event may carry; it is an opaque reference, and
 * redeeming it needs the signed server channel plus the Clerk session. No event,
 * tool result or model text authorizes a charge.
 */

export type DeedEvent = BaseEvent & Record<string, unknown>

const FORBIDDEN: Array<[string, RegExp]> = [
  ['card number', /\b(?:\d[ -]?){13,19}\b/],
  ['secret or token', /\b(?:sk|pk|rk|whsec|phc)_(?:live|test)?_?[A-Za-z0-9]{8,}|\bbd_live_[A-Za-z0-9]{6,}|\beyJ[A-Za-z0-9_-]{10,}/],
  ['card field', /\b(card[_ ]?number|cvc|cvv|security code)\b/i],
  ['vendor name', /\b(apify|tracerfy|bright ?data|propertyonion|batchdata|reiskip)\b/i],
  ['issue number', /(?:^|[^&\w])#\d{3,6}\b|\bissue\s*#?\d{3,6}\b/i],
]

export class PayloadViolation extends Error {
  constructor(public readonly kind: string) {
    super(`event payload rejected: ${kind}`)
    this.name = 'PayloadViolation'
  }
}

/** Throws PayloadViolation when any string in the event trips a forbidden pattern. */
export function cleanEvent<T extends object>(event: T): T {
  const json = JSON.stringify(event)
  // A UUID is 32 hex digits and would read as a card number; strip them first.
  // Hosted payment / billing page links are public by design and carry long ids; mask them, scan the rest.
  const scan = json.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'uuid')
    .replace(/https:\/\/(?:checkout|billing)\.stripe\.com\/[^"\s]+/g, 'https://hosted.example/link')
    .replace(/"timestamp":\d+/g, '"timestamp":0')
  for (const [kind, re] of FORBIDDEN) if (re.test(scan)) throw new PayloadViolation(kind)
  return event
}

export function sseEncode(event: object): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

const id = () => crypto.randomUUID()
const base = (type: EventType) => ({ type, timestamp: Date.now() })

export const ev = {
  runStarted: (threadId: string, runId: string) => ({ ...base(EventType.RUN_STARTED), threadId, runId }),
  runFinished: (threadId: string, runId: string) => ({ ...base(EventType.RUN_FINISHED), threadId, runId }),
  runError: (message: string, code?: string) => ({ ...base(EventType.RUN_ERROR), message, ...(code ? { code } : {}) }),
  text: (content: string) => {
    const messageId = id()
    return [
      { ...base(EventType.TEXT_MESSAGE_START), messageId, role: 'assistant' },
      { ...base(EventType.TEXT_MESSAGE_CONTENT), messageId, delta: content },
      { ...base(EventType.TEXT_MESSAGE_END), messageId },
    ]
  },
  /** One tool call: START (customer-facing label), ARGS, END, RESULT. */
  toolCall: (label: string, args: object, result: object) => {
    const toolCallId = id()
    return [
      { ...base(EventType.TOOL_CALL_START), toolCallId, toolCallName: label },
      { ...base(EventType.TOOL_CALL_ARGS), toolCallId, delta: JSON.stringify(args) },
      { ...base(EventType.TOOL_CALL_END), toolCallId },
      { ...base(EventType.TOOL_CALL_RESULT), messageId: id(), toolCallId, content: JSON.stringify(result), role: 'tool' },
    ]
  },
  state: (snapshot: object) => ({ ...base(EventType.STATE_SNAPSHOT), snapshot }),
  delta: (patch: Array<{ op: string; path: string; value?: unknown }>) => ({ ...base(EventType.STATE_DELTA), delta: patch }),
  custom: (name: string, value: object) => ({ ...base(EventType.CUSTOM), name, value }),
}

/** Wire names the panel reads. */
export const CUSTOM = {
  quoteCard: 'deed.quote_card',
  confirmCard: 'deed.confirm_card',
  checkoutCard: 'deed.checkout_card',
  accountCard: 'deed.account_card',
  invoicesCard: 'deed.invoices_card',
  linkCard: 'deed.link_card',
} as const
