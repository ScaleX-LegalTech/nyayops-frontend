import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getCauseList } from '@/lib/api/causeList'
import { qk } from '@/lib/queryKeys'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EntityAvatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/Feedback'
import { ListRowsSkeleton } from './DashboardPage'

/** Today's court cause list, filtered to the tenant's own CNR-linked cases only - a
 * court's full daily list is never fetched or shown here (NyayOps backend already
 * did that cross-referencing server-side). */
export function CauseListCard() {
  const { data, isLoading } = useQuery({
    queryKey: qk.causeList(undefined, 'mine'),
    queryFn: () => getCauseList(undefined, 'mine'),
    staleTime: 120_000,
  })
  const entries = data?.entries ?? []

  return (
    <Card>
      <CardHeader
        title="Today's cause list"
        description="Your cases listed for hearing today"
        action={
          <Link to="/cause-list" className="text-sm font-medium text-brand hover:text-brand-strong">
            View all
          </Link>
        }
      />
      <CardBody className="border-t border-border p-0">
        {isLoading ? (
          <ListRowsSkeleton />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nothing listed today"
            description="None of your CNR-linked cases appear on today's cause list."
          />
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <Link
                key={entry.case.id}
                to={`/cases/${entry.case.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted"
              >
                <EntityAvatar label={entry.case.title} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{entry.case.title}</p>
                  <p className="text-xs text-ink-muted">
                    Item {entry.item_number}
                    {entry.court_number ? ` · Court ${entry.court_number}` : ''}
                    {entry.judge ? ` · ${entry.judge}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
