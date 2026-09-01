import AppShell from '@/components/shell/AppShell'
import AlertDashboard from '@/components/alerts/AlertDashboard'
import SavedSearchesPanel from '@/components/workspace/SavedSearchesPanel'
import WatchlistPanel from '@/components/workspace/WatchlistPanel'

export const dynamic = 'force-dynamic'

export default function AlertsPage() {
  return (
    <AppShell>
      <AlertDashboard />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-10 sm:px-6 lg:grid-cols-2 lg:px-8">
        <SavedSearchesPanel />
        <WatchlistPanel />
      </div>
    </AppShell>
  )
}

export const metadata = {
  title: 'Alerts — BidDeed.AI',
  description: 'Private auction alerts for verified BidDeed.AI inventory.',
}
