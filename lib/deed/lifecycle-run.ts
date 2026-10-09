import { getRetryingSupabaseClient } from '@/lib/supabase-retry'
import { callLifecycle, type McpReply, type Verified } from '@/lib/deed/lifecycle-mcp'
import { cleanEvent, CUSTOM, ev, PayloadViolation, sseEncode, type DeedEvent } from '@/lib/deed/agui'
import { readLifecycleIntent, type LifecycleIntent, type Tier } from '@/lib/deed/lifecycle-intent'

/**
 * One Ask Deed run (issue #20664). Builds the AG-UI event sequence for a
 * lifecycle request and streams it. Money never moves here: every purchase or
 * plan change stops at a confirm card, and the only way past it is the confirm
 * route (a Clerk-verified click that the server turns into a signed redeem).
 */

const LABEL = {
  price: 'Checking the price list',
  order: 'Preparing your order',
  portal: 'Opening your billing page',
  account: 'Reading your account',
  invoices: 'Looking up your invoices',
  checkout: 'Creating your secure checkout',
} as const

const PLAN_LABEL: Record<Tier, string> = { investor: 'Investor', pro: 'Pro', proplus: 'Pro+' }
const TIERS: Tier[] = ['investor', 'pro', 'proplus']
const NO_CARD =
  'Card details are only ever entered on the secure checkout page. I never ask for them here.'

type Emit = (e: DeedEvent | DeedEvent[]) => void

interface RunCtx {
  who: Verified
  emit: Emit
  customerId: string | null
}

async function tool(ctx: RunCtx, label: string, tool: string, args: Record<string, unknown>, summarize: (r: McpReply) => object) {
  const reply = await callLifecycle(ctx.who, { op: 'call', tool, args })
  if (typeof reply.customer_id === 'string') ctx.customerId = reply.customer_id
  ctx.emit(ev.toolCall(label, safeArgs(args), reply.ok ? summarize(reply) : { ok: false }) as DeedEvent[])
  return reply
}

/** Only these argument keys are ever echoed in TOOL_CALL_ARGS. */
function safeArgs(args: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of ['product', 'tier', 'interval', 'county', 'case_number', 'flow']) if (args[k] != null) out[k] = args[k]
  return out
}

const money = (n: unknown) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '')

export async function runLifecycle(ctx: RunCtx, intent: LifecycleIntent): Promise<void> {
  const { emit } = ctx
  const say = (t: string) => emit(ev.text(t) as DeedEvent[])
  const fail = () => say('I could not reach billing just now, so nothing was started. Try again in a moment.')

  switch (intent.kind) {
    case 'affirm':
      say('To confirm an order, press the Confirm button on the order card. I can’t confirm for you, and typing “yes” never starts a charge.')
      return

    case 'quote': {
      const tiers = intent.report ? [] : intent.tier ? [intent.tier] : TIERS
      if (intent.report) {
        const r = await tool(ctx, LABEL.price, 'quote_price', { product: 'report' }, (x) => ({ amount_usd: (x.result as { amount_usd?: number })?.amount_usd }))
        if (!r.ok) return fail()
        const q = r.result as { amount_usd: number; name: string }
        emit(ev.custom(CUSTOM.quoteCard, { name: q.name, amount_usd: q.amount_usd, one_time: true }) as DeedEvent)
        say(`One SIGNAL$ Property Report is ${money(q.amount_usd)}, one time. Tell me the county and case number and I’ll set it up.`)
        return
      }
      const quotes: Array<{ tier: Tier; name: string; amount_usd: number; interval: string }> = []
      for (const tier of tiers) {
        const r = await tool(ctx, LABEL.price, 'quote_price', { product: 'subscription', tier, interval: intent.interval }, (x) => ({ amount_usd: (x.result as { amount_usd?: number })?.amount_usd }))
        if (!r.ok) return fail()
        const q = r.result as { amount_usd: number; name: string; interval: string }
        quotes.push({ tier, name: q.name, amount_usd: q.amount_usd, interval: q.interval })
      }
      emit(ev.delta([{ op: 'add', path: '/quote', value: quotes.map((q) => ({ tier: q.tier, amount_usd: q.amount_usd, interval: q.interval })) }]) as DeedEvent)
      for (const q of quotes) emit(ev.custom(CUSTOM.quoteCard, { tier: q.tier, name: q.name, amount_usd: q.amount_usd, interval: q.interval, one_time: false }) as DeedEvent)
      say(
        quotes.length === 1
          ? `${quotes[0].name} is ${money(quotes[0].amount_usd)} ${quotes[0].interval === 'annual' ? 'per year' : 'per month'}. Say “buy ${PLAN_LABEL[quotes[0].tier]}” and I’ll prepare the order for you to review.`
          : 'Here are the plans. Say “buy Investor” (or Pro, or Pro+) and I’ll prepare the order for you to review. Nothing is charged until you confirm.'
      )
      return
    }

    case 'buy': {
      if (!intent.tier) {
        say('Which plan would you like — Investor, Pro or Pro+? Ask “how much are the plans” to see the prices.')
        return
      }
      const r = await tool(ctx, LABEL.order, 'checkout_create', { product: 'subscription', tier: intent.tier, interval: intent.interval }, () => ({ ready: true }))
      return confirmCard(ctx, r, { action: 'checkout', product: 'subscription', plan: intent.tier, interval: intent.interval })
    }

    case 'buy_report': {
      if (!intent.county || !intent.caseNumber) {
        say('To order a SIGNAL$ Property Report I need the county and the case number of the sale, for example “report for Brevard case 2025-CA-012345”.')
        return
      }
      const r = await tool(ctx, LABEL.order, 'checkout_create', { product: 'report', county: intent.county, case_number: intent.caseNumber }, () => ({ ready: true }))
      return confirmCard(ctx, r, { action: 'checkout', product: 'report', county: intent.county, case_number: intent.caseNumber })
    }

    case 'portal': {
      const r = await tool(ctx, LABEL.portal, 'portal_link', {}, () => ({ ready: true }))
      if (!r.ok) return fail()
      const res = r.result as { available?: boolean; url?: string; message?: string }
      if (!res.available || !res.url) return say(res.message || 'There is no paid plan on this account yet.')
      emit(ev.custom(CUSTOM.linkCard, { label: 'Open your billing page', url: res.url }) as DeedEvent)
      say(`Your billing page is ready. ${NO_CARD}`)
      return
    }

    case 'cancel':
    case 'change_plan': {
      const flow = intent.kind === 'cancel' ? 'cancel' : 'change_plan'
      const r = await tool(ctx, LABEL.order, 'portal_link', { flow }, () => ({ ready: true }))
      if (!r.ok) return fail()
      const res = r.result as { available?: boolean; message?: string }
      if (res.available === false) return say(res.message || 'There is no paid plan on this account yet.')
      return confirmCard(ctx, r, { action: flow === 'cancel' ? 'cancel' : 'plan_change' })
    }

    case 'account': {
      const r = await tool(ctx, LABEL.account, 'account_get', {}, () => ({ ready: true }))
      if (!r.ok) return fail()
      const a = r.result as { plan: string; billing_on_file: boolean; credits_balance: number }
      emit(ev.custom(CUSTOM.accountCard, a) as DeedEvent)
      say(`You are on the ${a.plan} plan. ${a.billing_on_file ? 'Billing is set up.' : 'No billing is on file yet.'}`)
      return
    }

    case 'invoices': {
      const r = await tool(ctx, LABEL.invoices, 'invoices_list', {}, () => ({ ready: true }))
      if (!r.ok) return fail()
      const inv = (r.result as { invoices: Array<{ number: string | null; date: string | null; amount_usd: number; status: string; url: string | null }> }).invoices
      emit(ev.custom(CUSTOM.invoicesCard, { invoices: inv }) as DeedEvent)
      say(inv.length ? `Here are your ${inv.length} most recent invoices.` : 'There are no invoices on this account yet.')
      return
    }
  }
}

function confirmCard(ctx: RunCtx, r: McpReply, meta: Record<string, unknown>) {
  const { emit } = ctx
  const res = (r.result || {}) as { status?: string; confirm_ref?: string; readback?: string; amount_usd?: number; expires_at?: string; message?: string }
  if (!r.ok || res.status !== 'confirmation_required' || !res.confirm_ref) {
    emit(ev.text(res.message || 'I could not prepare that order just now, so nothing was started.') as DeedEvent[])
    return
  }
  emit(ev.delta([{ op: 'add', path: '/pendingConfirm', value: { ref: res.confirm_ref, expires_at: res.expires_at } }]) as DeedEvent)
  emit(ev.custom(CUSTOM.confirmCard, { ref: res.confirm_ref, readback: res.readback, amount_usd: res.amount_usd ?? 0, expires_at: res.expires_at, ...meta }) as DeedEvent)
  emit(ev.text(`${res.readback} Press Confirm to continue — it is valid for 5 minutes. ${NO_CARD}`) as DeedEvent[])
}

/**
 * Wraps a producer in an AG-UI run: RUN_STARTED … RUN_FINISHED (or RUN_ERROR),
 * every event hygiene-checked before it leaves, the sanitized log persisted.
 */
export function aguiResponse(opts: {
  who: Verified
  threadId: string
  produce: (ctx: RunCtx) => Promise<void>
}): Response {
  const runId = crypto.randomUUID()
  const log: DeedEvent[] = []
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const ctx: RunCtx = { who: opts.who, customerId: null, emit: () => {} }
      const push = (e: DeedEvent) => {
        cleanEvent(e)
        log.push(e)
        controller.enqueue(encoder.encode(sseEncode(e)))
      }
      ctx.emit = (e) => (Array.isArray(e) ? e.forEach(push) : push(e))
      try {
        push(ev.runStarted(opts.threadId, runId) as DeedEvent)
        await opts.produce(ctx)
        push(ev.runFinished(opts.threadId, runId) as DeedEvent)
      } catch (err) {
        const msg = err instanceof PayloadViolation ? 'Deed could not show that reply safely.' : 'Something went wrong. Nothing was charged.'
        console.error(JSON.stringify({ level: 'error', scope: 'deed.run', detail: (err as Error).message, ts: new Date().toISOString() }))
        // RUN_ERROR is built from fixed copy, so it needs no scan; it is still logged.
        const e = ev.runError(msg, err instanceof PayloadViolation ? 'PAYLOAD_REJECTED' : 'RUN_FAILED') as DeedEvent
        log.push(e)
        controller.enqueue(encoder.encode(sseEncode(e)))
      }
      await persistLog(runId, opts.threadId, ctx.customerId, log)
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function persistLog(runId: string, threadId: string, customerId: string | null, events: DeedEvent[]) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return
  try {
    const { error } = await getRetryingSupabaseClient(key)
      .from('ask_deed_event_log')
      .insert({ run_id: runId, thread_id: threadId, customer_id: customerId, channel: 'chat', events })
    if (error) console.error(JSON.stringify({ level: 'warn', scope: 'deed.run.log', code: error.code, ts: new Date().toISOString() }))
  } catch {
    /* the log is evidence, not part of the customer's answer */
  }
}

export { readLifecycleIntent }
