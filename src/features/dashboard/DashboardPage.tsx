import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  Briefcase,
  ClipboardClock,
  ClipboardList,
  History,
  IndianRupee,
  ShieldAlert,
  Users,
} from 'lucide-react'
import {
  getActivity,
  getCasesByStatus,
  getIssuesSummary,
  getKpis,
  getMyWork,
  getOverdueCases,
  getPaymentStatusSummary,
  getRecentActivity,
  getScrutinyActionRequired,
  getTopCourts,
  getUpcomingHearings,
} from '@/lib/api/dashboard'
import { getOrganizationName } from '@/lib/api/organization'
import { useAuth } from '@/auth/AuthContext'
import { usePermissions } from '@/lib/usePermissions'
import { useUsers } from '@/lib/useUsers'
import { qk } from '@/lib/queryKeys'
import { humanize, formatDate, formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { EntityAvatar } from '@/components/ui/Avatar'
import { EmptyState, Skeleton } from '@/components/ui/Feedback'
import { CHART_AXIS_TICK, CHART_BAR_FILL, CHART_TOOLTIP_CURSOR, STATUS_COLORS } from '@/lib/chartColors'
import type { Case, Issue, PaymentMilestone, RecentActivityItem } from '@/types'
import type { LucideIcon } from 'lucide-react'

// Aggregate dashboard stats don't need to feel real-time - a longer staleTime than
// the 30s default means wandering off to a case and back doesn't trigger a visible
// background refetch every time.
const DASHBOARD_STALE_TIME_MS = 120_000

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  isLoading,
}: {
  icon: LucideIcon
  label: string
  value: number | undefined
  tone: string
  isLoading?: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={`grid size-10 place-items-center rounded-control ${tone}`}>
          <Icon className="size-5" />
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="mt-4 h-9 w-14" />
      ) : (
        <p className="mt-4 text-3xl font-semibold tabular text-ink">{value ?? '—'}</p>
      )}
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </Card>
  )
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />
}

/** Small status-breakdown donut, generalized from the case-status chart above so
 * issues/payments summaries can reuse the same visual without duplicating the
 * larger primary "Case snapshot" chart's layout. */
function StatusDonutCard({
  title,
  description,
  icon,
  data,
  isLoading,
  emptyTitle,
  emptyDescription,
}: {
  title: string
  description?: string
  icon: LucideIcon
  data: { status: string; count: number }[]
  isLoading?: boolean
  emptyTitle: string
  emptyDescription?: string
}) {
  const chartData = data.map((d) => ({ name: humanize(d.status), value: d.count }))
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="border-t border-border">
        {isLoading ? (
          <ChartSkeleton height={160} />
        ) : chartData.length === 0 ? (
          <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={64}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-1.5">
              {chartData.map((d, i) => (
                <li key={d.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }}
                  />
                  <span className="flex-1 text-ink-muted">{d.name}</span>
                  <span className="font-medium tabular text-ink">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

/** Row-skeleton placeholder matching CaseListCard's row shape, shown while its
 * backing query is still in flight. */
function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Shared row-list card for anything that's fundamentally "a list of cases" - My
 * Cases, Next Hearings, and Overdue Flags all render this same shape. */
function CaseListCard({
  title,
  description,
  cases,
  isLoading,
  emptyTitle,
  emptyDescription,
  showHearingDate,
}: {
  title: string
  description?: string
  cases: Case[]
  isLoading?: boolean
  emptyTitle: string
  emptyDescription?: string
  showHearingDate?: boolean
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          <Link to="/cases" className="text-sm font-medium text-brand hover:text-brand-strong">
            View all
          </Link>
        }
      />
      <CardBody className="border-t border-border p-0">
        {isLoading ? (
          <ListRowsSkeleton />
        ) : cases.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="divide-y divide-border">
            {cases.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted"
              >
                <EntityAvatar label={c.title} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                  <p className="text-xs text-ink-muted">
                    {c.client_name}
                    {showHearingDate && c.hearing_date ? ` · Hearing ${formatDate(c.hearing_date)}` : ''}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function IssueListCard({ issues, isLoading }: { issues: Issue[]; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader
        title="Open issues needing your action"
        description="Routed to you, not yet resolved"
      />
      <CardBody className="border-t border-border p-0">
        {isLoading ? (
          <ListRowsSkeleton />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nothing waiting on you"
            description="No open issues are routed to you right now."
          />
        ) : (
          <div className="divide-y divide-border">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                to={`/cases/${issue.case_id}`}
                className="flex items-start gap-3 px-5 py-3 hover:bg-surface-muted"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control bg-warning-soft text-warning-strong">
                  <ClipboardList className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{issue.description}</p>
                  <p className="text-xs text-ink-muted">{formatDate(issue.created_at)}</p>
                </div>
                <Badge>{humanize(issue.issue_type)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function PaymentFollowUpCard({
  milestones,
  isLoading,
}: {
  milestones: PaymentMilestone[]
  isLoading?: boolean
}) {
  return (
    <Card>
      <CardHeader
        title="Payment follow-ups"
        description="Fee milestones still awaiting action, on your cases"
      />
      <CardBody className="border-t border-border p-0">
        {isLoading ? (
          <ListRowsSkeleton />
        ) : milestones.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title="Nothing to follow up on"
            description="No pending fee milestones on your cases."
          />
        ) : (
          <div className="divide-y divide-border">
            {milestones.map((m) => (
              <Link
                key={m.id}
                to={`/cases/${m.case_id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-control bg-info-soft text-info-strong">
                  <IndianRupee className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{m.label}</p>
                  {m.due_stage && <p className="text-xs text-ink-muted">{m.due_stage}</p>}
                </div>
                <Badge>{humanize(m.status)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function ActivityFeedCard({
  activity,
  isLoading,
}: {
  activity: RecentActivityItem[]
  isLoading?: boolean
}) {
  const { nameOf } = useUsers()
  return (
    <Card>
      <CardHeader
        title="Recent activity"
        description="Latest events on cases you created or are assigned to"
      />
      <CardBody className="border-t border-border p-0">
        {isLoading ? (
          <ListRowsSkeleton />
        ) : activity.length === 0 ? (
          <EmptyState
            icon={History}
            title="No activity yet"
            description="Actions on your cases will show up here."
          />
        ) : (
          <div className="divide-y divide-border">
            {activity.map((item) => (
              <Link
                key={item.id}
                to={`/cases/${item.case_id}`}
                className="flex items-start gap-3 px-5 py-3 hover:bg-surface-muted"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
                  <History className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{humanize(item.action_type)}</p>
                  <p className="text-xs text-ink-muted">
                    {nameOf(item.actor_id)} · {formatRelative(item.occurred_at)}
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

/** Personal dashboard - every authenticated user gets this, scoped to exactly what
 * they created/are assigned to/were routed. No permission required to view it. */
function MyWorkView() {
  const myWork = useQuery({
    queryKey: qk.myWork,
    queryFn: getMyWork,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const recentActivity = useQuery({
    queryKey: qk.recentActivity,
    queryFn: getRecentActivity,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const isLoading = myWork.isLoading
  const data = myWork.data

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <CaseListCard
          title="My cases"
          description="Cases you created or are assigned to"
          cases={data?.my_cases ?? []}
          isLoading={isLoading}
          emptyTitle="No cases yet"
          emptyDescription="Cases you create or get assigned to will show up here."
        />
        <IssueListCard issues={data?.open_issues ?? []} isLoading={isLoading} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <CaseListCard
          title="Next hearing dates"
          description="Your upcoming hearings, soonest first"
          cases={data?.upcoming_hearings ?? []}
          isLoading={isLoading}
          emptyTitle="No upcoming hearings"
          showHearingDate
        />
        <PaymentFollowUpCard milestones={data?.payment_follow_ups ?? []} isLoading={isLoading} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <CaseListCard
          title="Overdue flags"
          description="Past their hearing date and not yet closed"
          cases={data?.overdue_cases ?? []}
          isLoading={isLoading}
          emptyTitle="Nothing overdue"
          emptyDescription="You're on track."
          showHearingDate
        />
        <ActivityFeedCard
          activity={recentActivity.data ?? []}
          isLoading={recentActivity.isLoading}
        />
      </div>
    </div>
  )
}

/** The aggregate oversight view - unchanged from before, just extracted into its
 * own component so it mounts (and fetches) only when its tab is actually selected. */
function OverviewView() {
  const kpis = useQuery({
    queryKey: qk.kpis,
    queryFn: getKpis,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const byStatus = useQuery({
    queryKey: qk.casesByStatus,
    queryFn: getCasesByStatus,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const topCourts = useQuery({
    queryKey: qk.topCourts,
    queryFn: getTopCourts,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const activity = useQuery({
    queryKey: qk.activity,
    queryFn: getActivity,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const overdue = useQuery({
    queryKey: qk.overdue,
    queryFn: getOverdueCases,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const scrutinyActionRequired = useQuery({
    queryKey: qk.scrutinyActionRequired,
    queryFn: getScrutinyActionRequired,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const upcomingHearings = useQuery({
    queryKey: qk.upcomingHearings,
    queryFn: getUpcomingHearings,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const issuesSummary = useQuery({
    queryKey: qk.issuesSummary,
    queryFn: getIssuesSummary,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })
  const paymentStatusSummary = useQuery({
    queryKey: qk.paymentStatusSummary,
    queryFn: getPaymentStatusSummary,
    staleTime: DASHBOARD_STALE_TIME_MS,
  })

  const statusData = (byStatus.data ?? []).map((d) => ({
    name: humanize(d.status),
    value: d.count,
  }))
  const courtData = (topCourts.data ?? []).map((d) => ({
    name: d.court_jurisdiction,
    count: d.count,
  }))

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Briefcase}
          label="New cases today"
          value={kpis.data?.cases_today}
          tone="bg-brand-soft text-brand"
          isLoading={kpis.isLoading}
        />
        <KpiCard
          icon={ClipboardClock}
          label="Pending reviews"
          value={kpis.data?.pending_reviews}
          tone="bg-warning-soft text-warning-strong"
          isLoading={kpis.isLoading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue cases"
          value={kpis.data?.overdue_cases}
          tone="bg-danger-soft text-danger"
          isLoading={kpis.isLoading}
        />
        <KpiCard
          icon={Users}
          label="Associate activity"
          value={kpis.data?.associate_activity}
          tone="bg-info-soft text-info"
          isLoading={kpis.isLoading}
        />
        <KpiCard
          icon={ShieldAlert}
          label="Scrutiny action required"
          value={kpis.data?.scrutiny_action_required}
          tone="bg-danger-soft text-danger"
          isLoading={kpis.isLoading}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Case snapshot" description="Distribution across the workflow" />
          <CardBody className="border-t border-border">
            {byStatus.isLoading ? (
              <ChartSkeleton height={200} />
            ) : statusData.length === 0 ? (
              <EmptyState title="No cases yet" />
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="flex-1 space-y-1.5">
                  {statusData.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }}
                      />
                      <span className="flex-1 text-ink-muted">{d.name}</span>
                      <span className="font-medium tabular text-ink">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Court-wise snapshot" description="Where your caseload concentrates" />
          <CardBody className="border-t border-border">
            {topCourts.isLoading ? (
              <ChartSkeleton />
            ) : courtData.length === 0 ? (
              <EmptyState title="No court data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={courtData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12, fill: CHART_AXIS_TICK }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: CHART_TOOLTIP_CURSOR }} />
                  <Bar
                    dataKey="count"
                    fill={CHART_BAR_FILL}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader title="Activity today" />
          <CardBody className="grid grid-cols-3 gap-3 border-t border-border text-center">
            <div>
              {activity.isLoading ? (
                <Skeleton className="mx-auto h-7 w-8" />
              ) : (
                <p className="text-2xl font-semibold tabular text-ink">
                  {activity.data?.active_users_today ?? '—'}
                </p>
              )}
              <p className="mt-1 text-xs text-ink-muted">Active users</p>
            </div>
            <div>
              {activity.isLoading ? (
                <Skeleton className="mx-auto h-7 w-8" />
              ) : (
                <p className="text-2xl font-semibold tabular text-ink">
                  {activity.data?.cases_in_progress ?? '—'}
                </p>
              )}
              <p className="mt-1 text-xs text-ink-muted">In progress</p>
            </div>
            <div>
              {activity.isLoading ? (
                <Skeleton className="mx-auto h-7 w-8" />
              ) : (
                <p className="text-2xl font-semibold tabular text-ink">
                  {activity.data?.notifications_sent ?? '—'}
                </p>
              )}
              <p className="mt-1 text-xs text-ink-muted">Alerts sent</p>
            </div>
          </CardBody>
        </Card>

        <CaseListCard
          title="Overdue cases"
          description="Past their hearing date and not yet closed"
          cases={overdue.data ?? []}
          isLoading={overdue.isLoading}
          emptyTitle="Nothing overdue"
          emptyDescription="Your team is on track."
          showHearingDate
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <CaseListCard
          title="Scrutiny action required"
          description="Rejected scrutiny - needs a corrected document and re-approval"
          cases={scrutinyActionRequired.data ?? []}
          isLoading={scrutinyActionRequired.isLoading}
          emptyTitle="Nothing needs action"
          emptyDescription="No scrutiny has been rejected right now."
        />
        <CaseListCard
          title="Upcoming hearings"
          description="Across the firm, soonest first"
          cases={upcomingHearings.data ?? []}
          isLoading={upcomingHearings.isLoading}
          emptyTitle="No upcoming hearings"
          showHearingDate
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <StatusDonutCard
          title="Open issues"
          description="Document Missing / Info Needed / Blocker flags raised across all cases"
          icon={ClipboardList}
          data={issuesSummary.data ?? []}
          isLoading={issuesSummary.isLoading}
          emptyTitle="No issues raised"
          emptyDescription="Nothing to flag right now."
        />

        <StatusDonutCard
          title="Payment status"
          description="Fee milestones by status, across all cases"
          icon={IndianRupee}
          data={paymentStatusSummary.data ?? []}
          isLoading={paymentStatusSummary.isLoading}
          emptyTitle="No payment milestones"
          emptyDescription="No fee milestones have been created yet."
        />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { hasPermission } = usePermissions()
  const { isManagingDirector } = useAuth()
  const canSeeOverview = hasPermission('reports', 'read')
  const [tab, setTab] = useState<'my-work' | 'overview'>(canSeeOverview ? 'overview' : 'my-work')

  const orgName = useQuery({
    queryKey: qk.organizationName,
    queryFn: getOrganizationName,
    enabled: canSeeOverview && isManagingDirector,
  })
  const overviewLabel = isManagingDirector
    ? orgName.data?.name
      ? `${orgName.data.name} Overview`
      : 'Firm Overview'
    : 'Branch Overview'

  return (
    <div className="animate-rise">
      <PageHeader
        title="Dashboard"
        description="A pulse on your firm's casework today."
        actions={
          <div className="flex items-center gap-2">
            {canSeeOverview && (
              <div className="inline-flex rounded-control border border-border-strong bg-surface p-0.5" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'my-work'}
                  onClick={() => setTab('my-work')}
                  className={cn(
                    'rounded-control px-3 py-1.5 text-sm font-medium transition-colors',
                    tab === 'my-work' ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  My Work
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'overview'}
                  onClick={() => setTab('overview')}
                  className={cn(
                    'rounded-control px-3 py-1.5 text-sm font-medium transition-colors',
                    tab === 'overview' ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {overviewLabel}
                </button>
              </div>
            )}
          </div>
        }
      />

      {tab === 'my-work' || !canSeeOverview ? <MyWorkView /> : <OverviewView />}
    </div>
  )
}
