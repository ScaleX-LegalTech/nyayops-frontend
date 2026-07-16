import type {
  ActivityMetrics,
  Case,
  CasesByStatus,
  DashboardKpis,
  MyWorkResponse,
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

export function getMyWork(): Promise<MyWorkResponse> {
  return get<MyWorkResponse>('/dashboard/my-work')
}
