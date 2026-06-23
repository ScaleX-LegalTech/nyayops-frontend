import type {
  Case,
  CaseCreateRequest,
  CaseSearchFilters,
  CaseStatus,
} from '@/types'
import { del, get, patch, post, toQuery } from './client'

export function listCases(filters: CaseSearchFilters = {}): Promise<Case[]> {
  return get<Case[]>(`/cases${toQuery(filters)}`)
}

export function getCase(caseId: string): Promise<Case> {
  return get<Case>(`/cases/${caseId}`)
}

export function getCaseTransitions(): Promise<Record<CaseStatus, CaseStatus[]>> {
  return get<Record<CaseStatus, CaseStatus[]>>('/cases/transitions')
}

export function createCase(payload: CaseCreateRequest): Promise<Case> {
  return post<Case>('/cases', payload)
}

export function updateCase(caseId: string, payload: Partial<CaseCreateRequest>): Promise<Case> {
  return patch<Case>(`/cases/${caseId}`, payload)
}

export function deleteCase(caseId: string): Promise<Case> {
  return del<Case>(`/cases/${caseId}`)
}

export function updateCaseStatus(
  caseId: string,
  status: CaseStatus,
  comment?: string,
): Promise<Case> {
  return patch<Case>(`/cases/${caseId}/status`, { status, comment })
}

export function bulkAssignCases(caseIds: string[], assignedUserIds: string[]): Promise<Case[]> {
  return post<Case[]>('/cases/bulk-assign', {
    case_ids: caseIds,
    assigned_user_ids: assignedUserIds,
  })
}

// Review workflow ------------------------------------------------------------

export function reviewQueue(): Promise<Case[]> {
  return get<Case[]>('/review/queue')
}

export function approveCase(caseId: string, comment?: string): Promise<Case> {
  return post<Case>(`/review/${caseId}/approve`, { comment })
}

export function rejectCase(caseId: string, comment: string): Promise<Case> {
  return post<Case>(`/review/${caseId}/reject`, { comment })
}

export function reassignCase(
  caseId: string,
  assignedUserIds: string[],
  comment?: string,
): Promise<Case> {
  return post<Case>(`/review/${caseId}/reassign`, {
    assigned_user_ids: assignedUserIds,
    comment,
  })
}

export function addCaseComment(caseId: string, comment: string): Promise<Case> {
  return post<Case>(`/review/${caseId}/comments`, { comment })
}
