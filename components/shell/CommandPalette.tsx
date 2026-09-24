'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePathname, useRouter } from 'next/navigation'
import { CornerDownLeft, KeyRound, LifeBuoy, MessageSquarePlus, MessagesSquare, Search, UserRound, Wand2, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useDeedAuth } from '@/lib/deed/deedAuth'
import { listThreads, type ThreadSummary } from '@/lib/deed/threadsRemote'
import { SKILL_COMMANDS, SKILL_COMMAND_TARGET } from '@/lib/skills/commands'
import { TOOL_NAMES, type SkillTool } from '@/lib/skills/shared'
import { NAV_ITEMS } from './nav'

/**
 * ⌘K / Ctrl+K — search your chats and jump anywhere (PARITY CP-9, the C5
 * "⌘K" item). Claude.ai's palette is the reference: one box that finds a past
 * conversation by what was said in it, and the handful of places you go most.
 *
 * Signed in, "Chats" is the same server search the sidebar box runs
 * (/api/deed/threads?q=, owner-scoped by the Clerk session); signed out there
 * are no server chats to search, so only places and skills are offered. The
 * box is a WAI-ARIA combobox over one listbox: arrows move, Enter opens,
 * Escape closes, and focus returns to wherever it was.
 *
 * Open it with ⌘K / Ctrl+K from any page in the shell, or from the sidebar's
 * Search row (it dispatches OPEN_COMMAND_PALETTE).
 */

export const OPEN_COMMAND_PALETTE = 'biddeed:command-palette'

type Item = {
  id: string
  group: 'Chats' | 'Go to' | 'Skills'
  label: string
  hint?: string
  href: string
  external?: boolean
  icon: LucideIcon
}

const PLACES: Item[] = [
  { id: 'new-chat', group: 'Go to', label: 'New chat', hint: 'Ask Deed', href: '/chat', icon: MessageSquarePlus },
  { id: 'skills', group: 'Go to', label: 'Skills', hint: 'Run a county-record check', href: '/chat#skills', icon: Wand2 },
  ...NAV_ITEMS.map((n) => ({ id: `nav-${n.key}`, group: 'Go to' as const, label: n.label, hint: n.description, href: n.href, external: n.external, icon: n.icon })),
  { id: 'api-keys', group: 'Go to', label: 'API keys', hint: 'Connect Claude, Cursor or your agent', href: '/account/developers', icon: KeyRound },
  { id: 'account', group: 'Go to', label: 'Account', hint: 'Plan, reports and county monitors', href: '/account', icon: UserRound },
  { id: 'support', group: 'Go to', label: 'Support', hint: 'Ask a question or open a ticket', href: '/support', icon: LifeBuoy },
]

// The six skills, from the / menu's own list (minus /skills, which PLACES has):
// each opens the Skills panel on /chat with that skill chosen.
const SKILL_ITEMS: Item[] = SKILL_COMMANDS.filter((c) => SKILL_COMMAND_TARGET[c.name]).map((c) => {
  const slug = SKILL_COMMAND_TARGET[c.name] as SkillTool
  return {
    id: `skill-${c.name}`,
    group: 'Skills',
    label: TOOL_NAMES[slug] ?? c.label,
    hint: `${c.label} · ${c.hint}`,
    href: `/chat?skill=${slug}#skills`,
    icon: c.icon,
  }
})

function matches(item: Item, q: string): boolean {
  if (!q) return true
  const hay = `${item.label} ${item.hint ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [chats, setChats] = useState<ThreadSummary[]>([])
  const [searching, setSearching] = useState(false)
  const auth = useDeedAuth()
  const router = useRouter()
  const pathname = usePathname()
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()
  const listId = `${baseId}-list`

  // Where focus was before the palette opened; it goes back there on close
  // (a Dialog with no Trigger would otherwise drop it on <body>).
  const returnTo = useRef<HTMLElement | null>(null)
  const remember = () => {
    const el = document.activeElement
    if (el instanceof HTMLElement && el !== document.body && !el.closest('[role="dialog"]')) returnTo.current = el
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        remember()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => {
      remember()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_COMMAND_PALETTE, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  // Server chat search, debounced; the latest answer wins.
  useEffect(() => {
    if (!open || !auth.signedIn) {
      setChats([])
      return
    }
    let stale = false
    setSearching(true)
    const t = window.setTimeout(() => {
      void listThreads(query.trim() || undefined).then((rows) => {
        if (stale) return
        setChats((rows ?? []).slice(0, query.trim() ? 8 : 5))
        setSearching(false)
      })
    }, 180)
    return () => {
      stale = true
      window.clearTimeout(t)
    }
  }, [open, query, auth.signedIn])

  const items = useMemo(() => {
    const q = query.trim()
    const chatItems: Item[] = chats.map((c) => ({ id: `chat-${c.id}`, group: 'Chats', label: c.title, href: `/chat?c=${encodeURIComponent(c.id)}`, icon: MessagesSquare }))
    return [...chatItems, ...PLACES.filter((i) => matches(i, q)), ...SKILL_ITEMS.filter((i) => matches(i, q))]
  }, [chats, query])

  useEffect(() => {
    setActive((a) => (items.length === 0 ? 0 : Math.min(a, items.length - 1)))
  }, [items.length])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const go = useCallback(
    (item: Item) => {
      setOpen(false)
      if (item.external) {
        window.location.assign(item.href)
        return
      }
      const [path, hash] = item.href.split('#')
      // A hash on the page you are already on is not a navigation Next sees;
      // setting it fires the hashchange the /chat panels listen for.
      if (hash && path.split('?')[0] === pathname) {
        window.history.replaceState(null, '', path)
        window.location.hash = hash
        return
      }
      router.push(item.href)
    },
    [pathname, router]
  )

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (items.length ? (a + 1) % items.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(Math.max(0, items.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[active]
      if (item) go(item)
    }
  }

  const optionId = (i: number) => `${baseId}-opt-${i}`
  let lastGroup: string | null = null

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[85vh] w-full flex-col overflow-hidden border-b border-border bg-background shadow-lg sm:top-[12vh] sm:max-w-xl sm:rounded-xl sm:border"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            document.getElementById(`${baseId}-input`)?.focus()
          }}
          onCloseAutoFocus={(e) => {
            const el = returnTo.current
            returnTo.current = null
            if (el && el.isConnected) {
              e.preventDefault()
              el.focus()
            }
          }}
        >
          <Dialog.Title className="sr-only">Search chats and go anywhere</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id={`${baseId}-input`}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={items[active] ? optionId(active) : undefined}
              aria-label={auth.signedIn ? 'Search your chats, pages and skills' : 'Search pages and skills'}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={auth.signedIn ? 'Search chats, pages and skills' : 'Search pages and skills'}
              autoComplete="off"
              spellCheck={false}
              className="my-2 h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
            {items.length === 0 ? (
              <li role="presentation" className="px-3 py-6 text-center text-sm text-muted-foreground">
                {searching ? 'Searching…' : `Nothing matches “${query.trim()}”.`}
              </li>
            ) : (
              items.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null
                lastGroup = item.group
                const Icon = item.icon
                const selected = i === active
                return (
                  <li key={item.id} role="presentation">
                    {header ? (
                      <p role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-1">
                        {header}
                      </p>
                    ) : null}
                    <div
                      id={optionId(i)}
                      role="option"
                      aria-selected={selected}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(item)}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm',
                        selected ? 'bg-secondary text-secondary-foreground' : 'text-foreground'
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        {item.hint ? <span className="block truncate text-xs text-muted-foreground">{item.hint}</span> : null}
                      </span>
                      {selected ? <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
          <p className="hidden border-t border-border px-4 py-2 text-xs text-muted-foreground sm:block">
            <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to move · <kbd className="font-sans">Enter</kbd> to open ·{' '}
            <kbd className="font-sans">⌘K</kbd> or <kbd className="font-sans">Ctrl K</kbd> from anywhere
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
