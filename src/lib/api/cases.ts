import type {
  Case,
  CaseCnrLinkRequest,
  CaseCreateRequest,
  CaseDetailsRequest,
  CaseDetailsResponse,
  CaseFullDetailsResponse,
  CaseHistoryCreate,
  CaseLifecycleStage,
  CaseOption,
  CasePage,
  CasePartyCreate,
  CasePerson,
  CaseSearchFilters,
  CaseStatus,
  CaseUpdateRequest,
  CnrBusinessDetailResponse,
  CnrOrderDownloadResponse,
  ManualCaseDocument,
} from '@/types'
import { del, get, getBlob, patch, post, toQuery } from './client'

export function listCases(filters: CaseSearchFilters = {}): Promise<CasePage> {
  return get<CasePage>(`/cases${toQuery(filters)}`)
}

/** Backs case-picker dropdowns (document upload/filter) - id/title/status/
 * lifecycle_stage only, not the full CaseDashboardCard row shape. */
export function listCaseOptions(filters: CaseSearchFilters = {}): Promise<CaseOption[]> {
  return get<CaseOption[]>(`/cases/options${toQuery(filters)}`)
}

export function getCase(caseId: string): Promise<Case> {
  return get<Case>(`/cases/${caseId}`)
}

export function getCaseTransitions(): Promise<Record<CaseStatus, CaseStatus[]>> {
  return get<Record<CaseStatus, CaseStatus[]>>('/cases/transitions')
}

export function getCasePeople(caseId: string): Promise<CasePerson[]> {
  return get<CasePerson[]>(`/cases/${caseId}/people`)
}

/** Assign/Reassign dialog candidates - scoped to the given cases' own branch(es),
 * not every tenant user (see assignable-people on the backend). */
export function getAssignablePeople(caseIds: string[]): Promise<CasePerson[]> {
  const params = new URLSearchParams()
  caseIds.forEach((id) => params.append('case_ids', id))
  return get<CasePerson[]>(`/cases/assignable-people?${params.toString()}`)
}

export function createCase(payload: CaseCreateRequest): Promise<Case> {
  return post<Case>('/cases', payload)
}

export function addCaseDetails(
  caseId: string,
  payload: CaseDetailsRequest,
): Promise<CaseDetailsResponse> {
  return patch<CaseDetailsResponse>(`/cases/${caseId}/details`, payload)
}

export function approveScrutiny(caseId: string): Promise<Case> {
  return post<Case>(`/cases/${caseId}/scrutiny/approve`, {})
}

export function rejectScrutiny(caseId: string, reason: string): Promise<Case> {
  return post<Case>(`/cases/${caseId}/scrutiny/reject`, { reason })
}

export function linkCaseCnr(
  caseId: string,
  payload: CaseCnrLinkRequest,
): Promise<CaseDetailsResponse> {
  return post<CaseDetailsResponse>(`/cases/${caseId}/link-cnr`, payload)
}

export function refreshCaseCnr(caseId: string): Promise<CaseDetailsResponse> {
  return post<CaseDetailsResponse>(`/cases/${caseId}/refresh-cnr`, {})
}

export function getCaseFullDetails(caseId: string): Promise<CaseFullDetailsResponse> {
  return get<CaseFullDetailsResponse>(`/cases/${caseId}/full-details`)
}

export function setManualDocument(
  caseId: string,
  payload: ManualCaseDocument,
): Promise<CaseFullDetailsResponse> {
  return patch<CaseFullDetailsResponse>(`/cases/${caseId}/manual-document`, payload)
}

export function downloadCnrOrder(
  caseId: string,
  orderId: string,
): Promise<CnrOrderDownloadResponse> {
  return get<CnrOrderDownloadResponse>(`/cases/${caseId}/cnr-orders/${orderId}/download`)
}

/** Streams the order PDF's bytes through our own API (the extractor's download_url is
 * a different origin/auth scheme, unusable for an inline preview - see
 * preview_cnr_order on the backend). */
export function loadCnrOrderBlob(caseId: string, orderId: string): Promise<Blob> {
  return getBlob(`/cases/${caseId}/cnr-orders/${orderId}/preview`)
}

export function getCnrBusinessDetail(
  caseId: string,
  section: string,
  row: number,
): Promise<CnrBusinessDetailResponse> {
  return get<CnrBusinessDetailResponse>(
    `/cases/${caseId}/cnr-business${toQuery({ section, row })}`,
  )
}

export function addCaseParty(caseId: string, payload: CasePartyCreate): Promise<Case> {
  return post<Case>(`/cases/${caseId}/parties`, payload)
}

export function deleteCaseParty(caseId: string, partyId: string): Promise<Case> {
  return del<Case>(`/cases/${caseId}/parties/${partyId}`)
}

export function addCaseHistory(caseId: string, payload: CaseHistoryCreate): Promise<Case> {
  return post<Case>(`/cases/${caseId}/history`, payload)
}

export function deleteCaseHistory(caseId: string, historyId: string): Promise<Case> {
  return del<Case>(`/cases/${caseId}/history/${historyId}`)
}

export function assignCase(caseId: string, assignedUserIds: string[]): Promise<Case> {
  return post<Case>(`/cases/${caseId}/assign`, { assigned_user_ids: assignedUserIds })
}

export function updateCase(caseId: string, payload: CaseUpdateRequest): Promise<Case> {
  return patch<Case>(`/cases/${caseId}`, payload)
}

export function deleteCase(caseId: string): Promise<Case> {
  return del<Case>(`/cases/${caseId}`)
}

export function listDeletedCases(): Promise<Case[]> {
  return get<Case[]>('/cases/deleted')
}

export function restoreCase(caseId: string): Promise<Case> {
  return post<Case>(`/cases/${caseId}/restore`, {})
}

export function hardDeleteCase(caseId: string): Promise<void> {
  return del<void>(`/cases/${caseId}/permanent`)
}

export function updateCaseStatus(
  caseId: string,
  status: CaseStatus,
  comment?: string,
): Promise<Case> {
  return patch<Case>(`/cases/${caseId}/status`, { status, comment })
}

export function updateCaseLifecycleStage(
  caseId: string,
  lifecycleStage: CaseLifecycleStage,
  comment?: string,
): Promise<Case> {
  return patch<Case>(`/cases/${caseId}/lifecycle-stage`, {
    lifecycle_stage: lifecycleStage,
    comment,
  })
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

export function addCaseComment(
  caseId: string,
  comment: string,
  mentionedUserIds?: string[],
  attachmentDocumentIds?: string[],
  replyToMessageId?: string,
): Promise<Case> {
  return post<Case>(`/review/${caseId}/comments`, {
    comment,
    mentioned_user_ids: mentionedUserIds ?? [],
    attachment_document_ids: attachmentDocumentIds ?? [],
    reply_to_message_id: replyToMessageId ?? null,
  })
}

export function deleteCaseComment(
  caseId: string,
  commentId: string,
  scope: 'me' | 'everyone',
): Promise<Case> {
  return del<Case>(`/review/${caseId}/comments/${commentId}?scope=${scope}`)
}
