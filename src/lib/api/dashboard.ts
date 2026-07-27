import type {
  ActivityMetrics,
  Case,
  CasesByStatus,
  DashboardKpis,
  IssuesByStatus,
  MyWorkResponse,
  PaymentStatusSummary,
  RecentActivityItem,
  TopCourtMetric,
} from '@/types'
import { get } from './client'

export function getKpis(): Promise<DashboardKpis> {
  return get<DashboardKpis>('/dashboard/kpis')
}

export function getCasesByStatus(): Promise<CasesByStatus[]> {
  return get<CasesByStatus[]>('/dashboard/cases-by-status')
}

export function getTopCourts(): Promise<TopCourtMetric[]> {
  return get<TopCourtMetric[]>('/dashboard/top-courts')
}

export function getActivity(): Promise<ActivityMetrics> {
  return get<ActivityMetrics>('/dashboard/activity')
}

export function getOverdueCases(): Promise<Case[]> {
  return get<Case[]>('/dashboard/overdue')
}

export function getScrutinyActionRequired(): Promise<Case[]> {
  return get<Case[]>('/dashboard/scrutiny-action-required')
}

export function getMyWork(): Promise<MyWorkResponse> {
  return get<MyWorkResponse>('/dashboard/my-work')
}

export function getIssuesSummary(): Promise<IssuesByStatus[]> {
  return get<IssuesByStatus[]>('/dashboard/issues-summary')
}

export function getPaymentStatusSummary(): Promise<PaymentStatusSummary[]> {
  return get<PaymentStatusSummary[]>('/dashboard/payment-status')
}

export function getUpcomingHearings(): Promise<Case[]> {
  return get<Case[]>('/dashboard/upcoming-hearings')
}

export function getRecentActivity(): Promise<RecentActivityItem[]> {
  return get<RecentActivityItem[]>('/dashboard/recent-activity')
}
