'use client'

import { useEffect, useRef } from 'react'
import { Eraser, PencilRuler, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SlashCommand {
  name: string
  label: string
  hint: string
  icon: LucideIcon
}

/**
 * ONLY WIRED COMMANDS APPEAR HERE.
 *
 * A slash menu that lists a command it cannot run is a lie the user only
 * discovers after they have committed a keystroke to it. `/skills`, `/connect`,
 * `/report` and `/lang` are reserved in the grammar and deliberately absent
 * from this array until each one has a handler.
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'design',
    label: '/design',
    hint: 'Critique this screen against the BidDeed design system',
    icon: PencilRuler,
  },
  { name: 'clear', label: '/clear', hint: 'Start a new thread', icon: Eraser },
]

interface Props {
  query: string
  activeIndex: number
  onHover: (index: number) => void
  onPick: (command: SlashCommand) => void
}

export function filterCommands(query: string): SlashCommand[] {
  const q = query.replace(/^\//, '').toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(q))
}

/**
 * ARIA listbox, not a div with hover styles.
 *
 * The keyboard contract is the whole point: the caret stays in the textarea, so
 * the menu never receives DOM focus and the active option has to be announced
 * through aria-activedescendant on the input instead. Arrow keys, Enter, Tab
 * and Escape are handled by the composer and passed down as `activeIndex`.
 */
export default function SlashMenu({ query, activeIndex, onHover, onPick }: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const items = filterCommands(query)

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (items.length === 0) return null

  return (
    <ul
      ref={listRef}
      id="deed-slash-menu"
      role="listbox"
      aria-label="Commands"
      className={cn(
        'absolute bottom-full left-0 z-50 mb-2 max-h-56 w-full overflow-y-auto rounded-lg',
        'border border-slate-700 bg-[#0b1220] py-1 shadow-xl shadow-slate-950/60'
      )}
    >
      {items.map((c, i) => {
        const Icon = c.icon
        const active = i === activeIndex
        return (
          <li
            key={c.name}
            id={`deed-slash-${c.name}`}
            data-index={i}
            role="option"
            aria-selected={active}
            /*
             * onMouseMove, NOT onMouseEnter.
             *
             * The menu opens directly above the textarea, which is where the
             * pointer already is after clicking into it. mouseenter fires the
             * instant the list paints under a STATIONARY cursor, so the
             * keyboard's index was being overwritten before the user had
             * touched the mouse: type '/' and the highlight landed on whatever
             * row happened to be under the pointer instead of the first
             * command. Measured 2026-08-20 — '/clear' was selected on open,
             * and ArrowDown moved *up* the list from there.
             *
             * mousemove only fires once the pointer genuinely moves, so the
             * keyboard owns the selection until the user reaches for the mouse.
             */
            onMouseMove={() => onHover(i)}
            // onMouseDown, not onClick: click fires after the textarea has
            // already lost focus and scrolled the caret away.
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(c)
            }}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm',
              active ? 'bg-slate-800 text-white' : 'text-slate-300'
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-bd-orange" aria-hidden />
            <span className="min-w-0">
              <span className="font-medium">{c.label}</span>
              <span className="block truncate text-xs text-slate-500">{c.hint}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
