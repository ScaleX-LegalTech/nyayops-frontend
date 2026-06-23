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
import { AlertTriangle, Briefcase, ClipboardClock, Users } from 'lucide-react'
import {
  getActivity,
  getCasesByStatus,
  getKpis,
  getOverdueCases,
  getTopCourts,
} from '@/lib/api/dashboard'
import { qk } from '@/lib/queryKeys'
import { humanize, formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState, LoadingState } from '@/components/ui/Feedback'
import { CHART_AXIS_TICK, CHART_BAR_FILL, CHART_TOOLTIP_CURSOR, STATUS_COLORS } from '@/lib/chartColors'
import type { LucideIcon } from 'lucide-react'

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number | undefined
  tone: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className={`grid size-10 place-items-center rounded-control ${tone}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tabular text-ink">
        {value ?? '—'}
      </p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </Card>
  )
}

export default function DashboardPage() {
  const kpis = useQuery({ queryKey: qk.kpis, queryFn: getKpis })
  const byStatus = useQuery({ queryKey: qk.casesByStatus, queryFn: getCasesByStatus })
  const topCourts = useQuery({ queryKey: qk.topCourts, queryFn: getTopCourts })
  const activity = useQuery({ queryKey: qk.activity, queryFn: getActivity })
  const overdue = useQuery({ queryKey: qk.overdue, queryFn: getOverdueCases })

  if (kpis.isLoading) return <LoadingState label="Loading dashboard…" />

  const statusData = (byStatus.data ?? []).map((d) => ({
    name: humanize(d.status),
    value: d.count,
  }))
  const courtData = (topCourts.data ?? []).map((d) => ({
    name: d.court_jurisdiction,
    count: d.count,
  }))

  return (
    <div className="animate-rise">
      <PageHeader title="Dashboard" description="A pulse on your firm's casework today." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Briefcase}
          label="New cases today"
          value={kpis.data?.cases_today}
          tone="bg-brand-soft text-brand"
        />
        <KpiCard
          icon={ClipboardClock}
          label="Pending reviews"
          value={kpis.data?.pending_reviews}
          tone="bg-warning-soft text-warning-strong"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue cases"
          value={kpis.data?.overdue_cases}
          tone="bg-danger-soft text-danger"
        />
        <KpiCard
          icon={Users}
          label="Associate activity"
          value={kpis.data?.associate_activity}
          tone="bg-info-soft text-info"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cases by status" description="Distribution across the workflow" />
          <CardBody className="border-t border-border">
            {statusData.length === 0 ? (
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
          <CardHeader title="Top courts" description="Where your caseload concentrates" />
          <CardBody className="border-t border-border">
            {courtData.length === 0 ? (
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
                  <Bar dataKey="count" fill={CHART_BAR_FILL} radius={[0, 4, 4, 0]} barSize={18} />
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
              <p className="font-display text-2xl font-semibold tabular text-ink">
                {activity.data?.active_users_today ?? '—'}
              </p>
              <p className="mt-1 text-xs text-ink-muted">Active users</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold tabular text-ink">
                {activity.data?.cases_in_progress ?? '—'}
              </p>
              <p className="mt-1 text-xs text-ink-muted">In progress</p>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold tabular text-ink">
                {activity.data?.notifications_sent ?? '—'}
              </p>
              <p className="mt-1 text-xs text-ink-muted">Alerts sent</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Overdue cases"
            description="Past their hearing date and not yet closed"
            action={
              <Link to="/cases" className="text-sm font-medium text-brand hover:text-brand-strong">
                View all
              </Link>
            }
          />
          <CardBody className="border-t border-border p-0">
            {(overdue.data ?? []).length === 0 ? (
              <EmptyState title="Nothing overdue" description="Your team is on track." />
            ) : (
              <ul className="divide-y divide-border">
                {(overdue.data ?? []).slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/cases/${c.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                        <p className="text-xs text-ink-muted">
                          {c.client_name} · Hearing {formatDate(c.hearing_date)}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
