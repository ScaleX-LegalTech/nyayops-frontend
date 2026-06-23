import type { QueryClient } from '@tanstack/react-query'
import type { CaseSearchFilters, DocumentSearchFilters } from '@/types'

/** Central query-key registry so invalidation stays consistent. */
export const qk = {
  kpis: ['dashboard', 'kpis'] as const,
  casesByStatus: ['dashboard', 'cases-by-status'] as const,
  topCourts: ['dashboard', 'top-courts'] as const,
  activity: ['dashboard', 'activity'] as const,
  overdue: ['dashboard', 'overdue'] as const,
  cases: (filters: CaseSearchFilters = {}) => ['cases', 'list', filters] as const,
  caseDetail: (id: string) => ['cases', 'detail', id] as const,
  caseTransitions: ['cases', 'transitions'] as const,
  reviewQueue: ['review', 'queue'] as const,
  documents: (filters: DocumentSearchFilters = {}) => ['documents', 'list', filters] as const,
  users: ['users'] as const,
  branches: ['branches'] as const,
  roles: ['roles'] as const,
  permissions: ['permissions'] as const,
  auditLogs: ['audit-logs'] as const,
  notifications: ['notifications'] as const,
}

/** Invalidate everything case-related (lists, detail, review queue, dashboard). */
export const CASE_SCOPES = [['cases'], ['review'], ['dashboard']] as const

export function invalidateCaseScopes(queryClient: QueryClient) {
  CASE_SCOPES.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
}
