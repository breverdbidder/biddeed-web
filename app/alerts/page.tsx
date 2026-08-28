import AppShell from '@/components/shell/AppShell'
import AlertDashboard from '@/components/alerts/AlertDashboard'

export const dynamic = 'force-dynamic'

export default function AlertsPage() {
  return (
    <AppShell>
      <AlertDashboard />
    </AppShell>
  )
}

export const metadata = {
  title: 'Alerts — BidDeed.AI',
  description: 'Private auction alerts for verified BidDeed.AI inventory.',
}
