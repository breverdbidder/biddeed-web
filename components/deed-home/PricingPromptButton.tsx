'use client'

import { sendDeedPrompt } from './deedPromptEvent'

/**
 * A plan card's "ask Deed" button. The pricing section is server-rendered
 * (PageSpeed pass 3, 2026-10-07), so this is the one interactive piece of it:
 * it hands the prompt to the composer above via DEED_PROMPT_EVENT.
 */
export default function PricingPromptButton({ prompt, className, children }: { prompt: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => sendDeedPrompt(prompt)} className={className}>
      {children}
    </button>
  )
}
