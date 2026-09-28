/**
 * The titles on the sign-in and sign-up cards. Clerk's card renders them from
 * ConditionalClerkProvider's localization; AuthCardFallback renders the same
 * words while Clerk's script is still loading, so the heading never changes
 * under the visitor. One source for both.
 */
export const AUTH_CARD_COPY = {
  signIn: {
    title: 'Sign in to BidDeed.AI',
    subtitle: 'Welcome back! Please sign in to continue',
  },
  signUp: {
    title: 'Create your BidDeed.AI account',
    subtitle: 'One account works across BidDeed.AI and ZoneWise.AI',
  },
} as const
