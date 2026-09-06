import AdminInbox from '@/components/support/AdminInbox'

/**
 * biddeed.ai/admin/support — founder support inbox.
 *
 * NOT in middleware's isPublicRoute, so with Clerk enabled a signed-out
 * visitor is sent to /sign-in before this renders. The API behind it
 * (/api/support-tickets-admin) re-checks authorisation on every call
 * against public.support_admins (or the ADMIN_SUPPORT_TOKEN header), so
 * a signed-in customer who guesses this URL sees an empty inbox and a 403.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Support inbox — BidDeed.AI',
  robots: { index: false, follow: false },
}

export default function AdminSupportPage() {
  return <AdminInbox />
}
