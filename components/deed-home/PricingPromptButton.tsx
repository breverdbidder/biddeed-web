import { DEED_PROMPT_ATTR } from './deedPromptEvent'

/**
 * A plan card's "ask Deed" button. The pricing section is server-rendered
 * (PageSpeed pass 3, 2026-10-07), so the button carries its prompt as data
 * and DeedHome's delegated click listener sends it - no client code here.
 */
export default function PricingPromptButton({ prompt, className, children }: { prompt: string; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" {...{ [DEED_PROMPT_ATTR]: prompt }} className={className}>
      {children}
    </button>
  )
}
