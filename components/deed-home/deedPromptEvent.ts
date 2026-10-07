/**
 * Plan-card "ask Deed" buttons in the server-rendered landing sections carry
 * their prompt in this attribute; DeedHome listens for clicks on the document
 * and sends the prompt exactly as if it had been typed. Delegation keeps
 * the pricing section free of client code (no 'use client' island).
 */
export const DEED_PROMPT_ATTR = 'data-deed-prompt'
