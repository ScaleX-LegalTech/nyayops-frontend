import { useState } from 'react'
import { usePermissions } from '@/lib/usePermissions'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { MyBillQueueView } from '@/features/bills/MyBillQueueView'
import { AllBillsView } from '@/features/bills/AllBillsView'

/** Single "Bills" nav destination, mirroring the Dashboard's My Work / Overview
 * split: everyone gets "My queue" (their own assigned bills); anyone who can
 * raise/approve/manage bill types also gets "All bills" (org/branch-wide search,
 * filters, and the detail-dialog approve/reject flow). */
export default function BillsPage() {
  const { hasPermission } = usePermissions()
  const canManageBills =
    hasPermission('bills', 'create') ||
    hasPermission('bills', 'approve') ||
    hasPermission('bills', 'manage_types')
  const [tab, setTab] = useState<'my-queue' | 'all-bills'>(canManageBills ? 'all-bills' : 'my-queue')

  return (
    <div className="animate-rise">
      <PageHeader title="Bills" description="Billing and payment tracking across your cases." />

      {canManageBills && (
        <Tabs
          className="mb-4"
          tabs={[
            { value: 'all-bills', label: 'All bills' },
            { value: 'my-queue', label: 'My queue' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      )}

      {tab === 'all-bills' && canManageBills ? <AllBillsView /> : <MyBillQueueView />}
    </div>
  )
}
