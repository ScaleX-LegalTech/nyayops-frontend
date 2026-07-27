import type { Bill, BillCaseTypeCategory, BillFlowDirection, BillPaymentDestinationType, BillSearchFilters, BillSummary } from '@/types'
import { del, get, patch, post, toQuery } from './client'

export interface BillLineItemInputPayload {
  description: string
  amount: number
}

export interface BillCreatePayload {
  associate_id: string
  bill_type_id?: string
  custom_type_label?: string
  flow_direction: BillFlowDirection
  amount?: number
  line_items?: BillLineItemInputPayload[]
  due_stage?: string
  due_date?: string
  payment_destination_type: BillPaymentDestinationType
  payment_destination_value: string
  payment_info_document_id?: string
  save_as_reusable_type?: boolean
  case_type_category?: BillCaseTypeCategory
}

export function raiseBill(caseId: string, payload: BillCreatePayload): Promise<Bill> {
  return post<Bill>(`/cases/${caseId}/bills`, payload)
}

export function listBillsForCase(caseId: string): Promise<Bill[]> {
  return get<Bill[]>(`/cases/${caseId}/bills`)
}

export function listBills(filters: BillSearchFilters = {}): Promise<Bill[]> {
  return get<Bill[]>(`/bills${toQuery(filters)}`)
}

/** Always self-scoped - feeds both the dashboard "Payment follow-ups" card and the
 * Associate Bill Queue page. */
export function getMyBillQueue(): Promise<Bill[]> {
  return get<Bill[]>('/bills/my-queue')
}

/** Organization scope only - feeds the Overview tab's "Payment status" widget. */
export function getBillSummary(): Promise<BillSummary> {
  return get<BillSummary>('/bills/summary')
}

export function getBill(billId: string): Promise<Bill> {
  return get<Bill>(`/bills/${billId}`)
}

export function markBillContacted(billId: string): Promise<Bill> {
  return patch<Bill>(`/bills/${billId}/mark-contacted`)
}

export function uploadBillProof(billId: string, proofDocumentId: string): Promise<Bill> {
  return post<Bill>(`/bills/${billId}/proof`, { proof_document_id: proofDocumentId })
}

export function approveBill(billId: string): Promise<Bill> {
  return post<Bill>(`/bills/${billId}/approve`)
}

export function rejectBill(billId: string, reason: string): Promise<Bill> {
  return post<Bill>(`/bills/${billId}/reject`, { reason })
}

export function addBillComment(
  billId: string,
  comment: string,
  mentionedUserIds?: string[],
  attachmentDocumentIds?: string[],
  replyToMessageId?: string,
): Promise<Bill> {
  return post<Bill>(`/bills/${billId}/comments`, {
    comment,
    mentioned_user_ids: mentionedUserIds ?? [],
    attachment_document_ids: attachmentDocumentIds ?? [],
    reply_to_message_id: replyToMessageId ?? null,
  })
}

export function deleteBillComment(
  billId: string,
  commentId: string,
  scope: 'me' | 'everyone',
): Promise<Bill> {
  return del<Bill>(`/bills/${billId}/comments/${commentId}?scope=${scope}`)
}
