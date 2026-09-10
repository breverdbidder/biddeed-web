/**
 * Client-side privacy containment for chat history persistence (issue #80).
 *
 * The Worker/API-side containment and the permanent verified-owner boundary
 * are specified in cli-anything-biddeed#20226 (authoritative for the shared
 * acceptance tests). This flag gates only what this app's own client
 * controls: the localStorage-backed "Recent" sidebar and thread reload via
 * `?c=<id>` in lib/deed/threads.ts, plus the wipe-on-load/auth-transition
 * cleanup in components/shell/ChatHistoryContainmentGate.tsx and
 * ChatHistoryContainmentAuthWatcher.tsx.
 *
 * `NEXT_PUBLIC_CHAT_HISTORY_CONTAINMENT` defaults to containment ON (this
 * returns `true`) unless explicitly set to `'false'` — a privacy boundary
 * should fail closed. To flip it off once the permanent boundary in #20226
 * ships, set the env var to `'false'`, or delete every call site of this
 * function.
 */
export function chatHistoryContainmentEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHAT_HISTORY_CONTAINMENT !== 'false'
}
