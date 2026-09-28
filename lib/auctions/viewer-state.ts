/**
 * The auction pin card's viewer state: anonymous, free member or investor.
 * It only drives presentation; /api/auctions and /api/auctions/map redact the
 * gated fields server-side for the same viewer classes.
 *
 * 28 Sep 2026: this answer used to be fetched once per page session and kept
 * for good. An anonymous answer therefore outlived the visitor's sign-up: a
 * new member who came back to the map without a document reload, or whose
 * first card opened while the Clerk session was still landing server-side,
 * kept seeing the locks and the same "Unlock with Free" button. PostHog shows
 * it on a real registration on 26 Sep: the new member clicked
 * "Unlock with Free" again after signing up and was sent back to /radar.
 * Now every card open asks again. The last answer is shown meanwhile, so
 * a signed-in viewer does not see the locks flash, and cards opened together
 * share one request. Any failure answers 'anonymous' (locks shown).
 *
 * No imports, so scripts/validate-pin-card-viewer.mts runs it under plain node.
 */
export type ViewerState = 'anonymous' | 'free_member' | 'investor'

/** The body of GET /api/viewer/tier. */
export type TierAnswer = { tier_id?: string; signed_in?: boolean }

export function viewerFromAnswer(answer: TierAnswer, atLeastInvestor: (tierId: string) => boolean): ViewerState {
  if (atLeastInvestor(answer.tier_id ?? 'free')) return 'investor'
  return answer.signed_in ? 'free_member' : 'anonymous'
}

export type ViewerResolver = {
  /** The newest settled answer, or null before the first one. */
  last: () => ViewerState | null
  /** Asks the server now; concurrent callers share the request in flight. */
  resolve: () => Promise<ViewerState>
}

export function createViewerResolver(
  ask: () => Promise<TierAnswer>,
  atLeastInvestor: (tierId: string) => boolean
): ViewerResolver {
  let last: ViewerState | null = null
  let inflight: Promise<ViewerState> | null = null
  return {
    last: () => last,
    resolve() {
      if (!inflight) {
        inflight = Promise.resolve()
          .then(ask)
          .then((answer) => viewerFromAnswer(answer, atLeastInvestor))
          .catch((): ViewerState => 'anonymous')
          .then((viewer) => {
            last = viewer
            inflight = null
            return viewer
          })
      }
      return inflight
    },
  }
}
