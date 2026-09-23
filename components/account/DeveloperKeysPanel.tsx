'use client'

import { useCallback, useMemo, useState } from 'react'

import {
  BLOCK_MESSAGES,
  MCP_ENDPOINT,
  REVOKE_PROPAGATION_MINUTES,
  type CreatedKey,
  type DeveloperKey,
  type KeyListing,
} from '@/lib/developer-keys/shared'

const CARD = 'mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6'
const CTA =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50'
const CTA_QUIET =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-5 text-sm font-semibold text-secondary-foreground outline-none transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50'
const CTA_DANGER =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-background px-4 text-sm font-semibold text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50'

const KEY_PLACEHOLDER = 'YOUR_API_KEY'

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
  timeZoneName: 'short',
})

function formatDate(value: string | null, withTime = false): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return (withTime ? dateTimeFormat : dateFormat).format(parsed)
}

const TIER_NAMES: Record<string, string> = { free: 'Free', investor: 'Investor', pro: 'Pro', proplus: 'Pro Plus', enterprise: 'Enterprise' }

function tierName(value: string): string {
  return TIER_NAMES[value] ?? value.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

function maskedPrefix(prefix: string): string {
  return `${prefix}…`
}

const SESSION_ENDED = 'Your sign-in has ended. Refresh the page and sign in again to manage your key.'

/** A signed-out call is redirected to /sign-in (HTML), so it can look "ok" to fetch. */
function sessionEnded(response: Response): boolean {
  return response.redirected || !(response.headers.get('content-type') ?? '').includes('application/json')
}

async function readError(response: Response, fallback: string): Promise<string> {
  if (response.status === 401 || sessionEnded(response)) return SESSION_ENDED
  try {
    const body = await response.json()
    return typeof body?.error === 'string' ? body.error : fallback
  } catch {
    return fallback
  }
}

function StatusPill({ status }: { status: DeveloperKey['status'] }) {
  const tone =
    status === 'active'
      ? 'border-primary/30 bg-primary/10 text-primary'
      : status === 'expired'
        ? 'border-destructive/30 bg-destructive/10 text-destructive'
        : 'border-border bg-muted text-muted-foreground'
  const label = status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Revoked'
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
}

function CopyButton({ text, label, copiedLabel = 'Copied' }: { text: string; label: string; copiedLabel?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <button
      type="button"
      className={CTA_QUIET}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState('copied')
        } catch {
          setState('failed')
        }
        window.setTimeout(() => setState('idle'), 2500)
      }}
    >
      <span aria-live="polite">{state === 'copied' ? copiedLabel : state === 'failed' ? 'Select and copy it manually' : label}</span>
    </button>
  )
}

type SnippetId = 'claude-code' | 'cursor' | 'claude-desktop' | 'curl'

function snippets(key: string): Record<SnippetId, { label: string; where: string; code: string }> {
  return {
    'claude-code': {
      label: 'Claude Code',
      where: 'Run this once in your terminal. Claude Code keeps the server for every session.',
      code: `claude mcp add --transport http biddeed ${MCP_ENDPOINT} \\\n  --header "Authorization: Bearer ${key}"`,
    },
    cursor: {
      label: 'Cursor',
      where: 'Add this to ~/.cursor/mcp.json (or .cursor/mcp.json in a project), then reload Cursor.',
      code: JSON.stringify({ mcpServers: { biddeed: { url: MCP_ENDPOINT, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
    },
    'claude-desktop': {
      label: 'Claude Desktop',
      where: 'Add this to claude_desktop_config.json (Settings → Developer → Edit Config), then restart Claude. Needs Node.js 18 or newer.',
      code: JSON.stringify(
        {
          mcpServers: {
            biddeed: {
              command: 'npx',
              args: ['-y', 'mcp-remote', MCP_ENDPOINT, '--header', 'Authorization:${BIDDEED_AUTH}'],
              env: { BIDDEED_AUTH: `Bearer ${key}` },
            },
          },
        },
        null,
        2,
      ),
    },
    curl: {
      label: 'Test with curl',
      where:
        'A small call that checks your key: it lists the Florida counties BidDeed.AI currently certifies. A wrong, revoked or expired key comes back as AUTH_ERROR instead.',
      code: `curl -s ${MCP_ENDPOINT} \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_certified_counties","arguments":{}}}'`,
    },
  }
}

export default function DeveloperKeysPanel({ initial, initialError }: { initial: KeyListing; initialError: string | null }) {
  const [listing, setListing] = useState<KeyListing>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<'create' | string | null>(null)
  const [confirming, setConfirming] = useState<'create' | string | null>(null)
  const [created, setCreated] = useState<CreatedKey | null>(null)
  const [snippet, setSnippet] = useState<SnippetId>('claude-code')

  const activeKey = useMemo(() => listing.keys.find((key) => key.status === 'active') ?? null, [listing.keys])
  const history = useMemo(() => listing.keys.filter((key) => key.key_id !== activeKey?.key_id), [listing.keys, activeKey])
  const code = useMemo(() => snippets(created?.key ?? KEY_PLACEHOLDER)[snippet], [created, snippet])

  const refresh = useCallback(async () => {
    const response = await fetch('/api/developer/keys', { cache: 'no-store' })
    if (!response.ok || sessionEnded(response)) throw new Error(await readError(response, 'Could not refresh your keys.'))
    setListing((await response.json()) as KeyListing)
  }, [])

  const createKey = useCallback(async () => {
    setBusy('create')
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/developer/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'create_key' }),
      })
      if (!response.ok || sessionEnded(response)) {
        setError(await readError(response, 'Could not create a key. Nothing was changed; try again.'))
        return
      }
      const body = (await response.json()) as { created: CreatedKey }
      setCreated(body.created)
      setSnippet('claude-code')
      setConfirming(null)
      await refresh().catch(() => undefined)
    } catch {
      setError('Could not reach BidDeed.AI. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }, [refresh])

  const revokeKey = useCallback(
    async (key: DeveloperKey) => {
      setBusy(key.key_id)
      setError(null)
      setNotice(null)
      try {
        const response = await fetch(`/api/developer/keys/${encodeURIComponent(key.key_id)}`, { method: 'DELETE' })
        if (!response.ok || sessionEnded(response)) {
          setError(await readError(response, 'Could not revoke the key. Try again.'))
          return
        }
        if (created?.key_id === key.key_id) setCreated(null)
        setConfirming(null)
        setNotice(`Revoked ${maskedPrefix(key.key_prefix)} Anything still using it stops working within ${REVOKE_PROPAGATION_MINUTES} minutes.`)
        await refresh().catch(() => undefined)
      } catch {
        setError('Could not reach BidDeed.AI. Check your connection and try again.')
      } finally {
        setBusy(null)
      }
    },
    [created, refresh],
  )

  const blockMessage = listing.block_reason ? BLOCK_MESSAGES[listing.block_reason] : null
  const createLabel = activeKey ? 'Replace key' : 'Create key'

  return (
    <>
      {error ? (
        <p role="alert" className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-8 rounded-xl border border-border bg-secondary p-4 text-sm text-secondary-foreground">
          {notice}
        </p>
      ) : null}

      {created ? (
        <section className="mt-8 rounded-2xl border-2 border-primary bg-card p-5 sm:p-6" aria-labelledby="new-key-heading">
          <h2 id="new-key-heading" className="text-lg font-semibold text-card-foreground">
            Copy your new key now
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            This is the only time the full key is shown. BidDeed.AI keeps only a fingerprint of it, so
            nobody, including support, can show it to you again. Put it in your password manager or
            your tool&apos;s secret settings.
            {created.replaced_key_ids.length > 0
              ? ` Your previous key stops working within ${REVOKE_PROPAGATION_MINUTES} minutes.`
              : ''}
          </p>
          <label htmlFor="new-api-key" className="sr-only">
            Your new API key
          </label>
          <input
            id="new-api-key"
            readOnly
            value={created.key}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-4 min-h-11 w-full rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <CopyButton text={created.key} label="Copy key" copiedLabel="Key copied" />
            <button type="button" className={CTA} onClick={() => setCreated(null)}>
              I&apos;ve saved it
            </button>
          </div>
          {created.expires_at ? (
            <p className="mt-4 text-sm text-muted-foreground">
              This key belongs to a trial that ends {formatDate(created.expires_at, true)}.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="key-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="key-heading" className="text-lg font-semibold text-card-foreground">
              Your key
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {listing.tier ? `${tierName(listing.tier)} plan · ` : ''}Endpoint <span className="font-mono text-foreground">{MCP_ENDPOINT}</span>
            </p>
          </div>
          {listing.can_create && confirming !== 'create' ? (
            <button type="button" className={activeKey ? CTA_QUIET : CTA} disabled={busy !== null} onClick={() => (activeKey ? setConfirming('create') : void createKey())}>
              {busy === 'create' ? 'Creating…' : createLabel}
            </button>
          ) : null}
        </div>

        {confirming === 'create' && activeKey ? (
          <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
            <p className="text-sm text-secondary-foreground">
              Replace <span className="font-mono">{maskedPrefix(activeKey.key_prefix)}</span> with a new key? Anything using
              the current key stops working within {REVOKE_PROPAGATION_MINUTES} minutes, so update your tools with the new
              key right away.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className={CTA} disabled={busy !== null} onClick={() => void createKey()}>
                {busy === 'create' ? 'Replacing…' : 'Replace key'}
              </button>
              <button type="button" className={CTA_QUIET} disabled={busy !== null} onClick={() => setConfirming(null)}>
                Keep current key
              </button>
            </div>
          </div>
        ) : null}

        {activeKey ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-foreground">{maskedPrefix(activeKey.key_prefix)}</span>
                <StatusPill status={activeKey.status} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Created {formatDate(activeKey.created_at)} ·{' '}
                {activeKey.last_used_at ? `Last used ${formatDate(activeKey.last_used_at, true)}` : 'Not used yet'}
                {activeKey.expires_at ? ` · Trial ends ${formatDate(activeKey.expires_at)}` : ''}
              </p>
            </div>
            {confirming === activeKey.key_id ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-foreground">Revoke it? Your tools lose access.</span>
                <button type="button" className={CTA_DANGER} disabled={busy !== null} onClick={() => void revokeKey(activeKey)}>
                  {busy === activeKey.key_id ? 'Revoking…' : 'Revoke key'}
                </button>
                <button type="button" className={CTA_QUIET} disabled={busy !== null} onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className={CTA_DANGER} disabled={busy !== null} onClick={() => setConfirming(activeKey.key_id)}>
                Revoke
              </button>
            )}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-border bg-secondary p-4 text-sm text-secondary-foreground">
            {listing.can_create
              ? 'You have no active key. Create one to connect Claude, Cursor or your own agent.'
              : blockMessage ?? 'You have no active key.'}
          </p>
        )}

        {!listing.can_create && blockMessage && activeKey ? <p className="mt-4 text-sm text-muted-foreground">{blockMessage}</p> : null}
        {!listing.can_create && (listing.block_reason === 'no_plan' || listing.block_reason === 'plan_expired') ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/pricing" className={CTA}>
              {listing.block_reason === 'plan_expired' ? 'Renew your plan' : 'See the plans'}
            </a>
            <a href="/support" className={CTA_QUIET}>
              Ask a question first
            </a>
          </div>
        ) : null}

        {history.length > 0 ? (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Previous keys ({history.length})</summary>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {history.map((key) => (
                <li key={key.key_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="font-mono text-sm text-muted-foreground">{maskedPrefix(key.key_prefix)}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {key.revoked_at ? `Revoked ${formatDate(key.revoked_at)}` : `Created ${formatDate(key.created_at)}`}
                    <StatusPill status={key.status} />
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className={CARD} aria-labelledby="connect-heading">
        <h2 id="connect-heading" className="text-lg font-semibold text-card-foreground">
          Connect your tools
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {created
            ? 'These snippets already contain your new key. Copy one before you close this page.'
            : `Replace ${KEY_PLACEHOLDER} with your key. The server speaks MCP over streamable HTTP and authenticates with a Bearer header.`}
        </p>
        <div role="tablist" aria-label="Where to connect" className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(snippets(KEY_PLACEHOLDER)) as SnippetId[]).map((id) => (
            <button
              key={id}
              id={`snippet-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={snippet === id}
              aria-controls="snippet-panel"
              onClick={() => setSnippet(id)}
              className={`min-h-11 rounded-xl border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                snippet === id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              {snippets(KEY_PLACEHOLDER)[id].label}
            </button>
          ))}
        </div>
        <div id="snippet-panel" role="tabpanel" aria-labelledby={`snippet-tab-${snippet}`} className="mt-4">
          <p className="text-sm text-muted-foreground">{code.where}</p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-muted p-4 font-mono text-xs leading-5 text-foreground">
            <code>{code.code}</code>
          </pre>
          <div className="mt-3">
            <CopyButton text={code.code} label="Copy snippet" copiedLabel="Snippet copied" />
          </div>
        </div>
        <ul className="mt-6 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>Keep the key out of chats, screenshots and code repositories. Anyone holding it can spend your plan.</li>
          <li>Revoked keys stop working within {REVOKE_PROPAGATION_MINUTES} minutes. If a key leaks, replace it here right away.</li>
          <li>
            Each key carries your plan&apos;s hourly and daily call limits.{' '}
            <a href="/account" className="font-semibold text-primary underline-offset-4 hover:underline">
              See your plan
            </a>
          </li>
        </ul>
      </section>
    </>
  )
}
