/**
 * A prompt sent to Deed from outside the home page's React state - the
 * server-rendered landing sections below the composer (PricingPromptButton).
 * DeedHome listens and sends it exactly as if it had been typed.
 */
export const DEED_PROMPT_EVENT = 'biddeed:deed-prompt'

export function sendDeedPrompt(prompt: string) {
  window.dispatchEvent(new CustomEvent<string>(DEED_PROMPT_EVENT, { detail: prompt }))
}
