import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getCauseList } from '@/lib/api/causeList'
import { qk } from '@/lib/queryKeys'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { DatePicker } from '@/components/ui/DatePicker'
import { EntityAvatar } from '@/components/ui/Avatar'
import { EmptyState, LoadingState } from '@/components/ui/Feedback'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function CauseListPage() {
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [date, setDate] = useState(todayIso())

  const { data, isLoading } = useQuery({
    queryKey: qk.causeList(date, scope),
    queryFn: () => getCauseList(date, scope),
  })
  const entries = data?.entries ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cause list"
        description="Your firm's CNR-linked cases appearing on a court's cause list for the selected date."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { value: 'all', label: 'All cause list' },
            { value: 'mine', label: 'My cause list' },
          ]}
          value={scope}
          onChange={(v) => setScope(v as 'mine' | 'all')}
        />
        <DatePicker value={date} onChange={setDate} placeholder="Date" />
      </div>

      {isLoading ? (
        <Card>
          <CardBody>
            <LoadingState />
          </CardBody>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing listed"
              description={
                scope === 'mine'
                  ? "None of your cases appear on this date's cause list."
                  : "None of the firm's CNR-linked cases appear on this date's cause list."
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <Card key={`${entry.case.id}-${i}`}>
              <Link to={`/cases/${entry.case.id}`} className="block hover:bg-surface-muted">
                <CardBody className="flex items-start gap-3">
                  <EntityAvatar label={entry.case.title} size="sm" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {entry.case_number_raw ?? entry.case.title}
                      </p>
                      {entry.party_names_raw && (
                        <p className="text-sm text-ink">{entry.party_names_raw}</p>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ink-faint">Court / Bench</dt>
                        <dd className="text-sm text-ink">{entry.bench_name ?? entry.source_bench_key}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ink-faint">Court room</dt>
                        <dd className="text-sm text-ink">{entry.court_number ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ink-faint">Time</dt>
                        <dd className="text-sm text-ink">{entry.sitting_time ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ink-faint">List type</dt>
                        <dd className="text-sm text-ink">
                          {entry.list_type ? entry.list_type.replace(/_/g, ' ') : '—'}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-4">
                        <dt className="text-xs uppercase tracking-wide text-ink-faint">Judges</dt>
                        <dd className="text-sm text-ink">{entry.judge ?? '—'}</dd>
                      </div>
                    </dl>
                  </div>
                </CardBody>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
