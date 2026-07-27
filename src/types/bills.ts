import type { ThreadComment } from './threads'

export type BillStatus = 'raised' | 'client_contacted' | 'proof_uploaded' | 'approved'
export type BillFlowDirection = 'collection' | 'refund'
export type BillCaseTypeCategory = 'tsr_apf' | 'suit' | 'demand_notice' | 'other'
export type BillPaymentDestinationType = 'upi' | 'bank_transfer' | 'cheque' | 'other'

export interface BillLineItem {
  id: string
  description: string
  amount: number
}

export interface BillType {
  id: string
  label: string
  case_type: BillCaseTypeCategory
  default_direction: BillFlowDirection
  is_system_seed: boolean
  is_active: boolean
}

export interface Bill {
  id: string
  case_id: string
  case_title: string
  case_client_name: string
  branch_id: string | null
  associate_id: string
  raised_by: string
  bill_type_id: string | null
  custom_type_label: string | null
  flow_direction: BillFlowDirection
  amount: number | null
  line_items: BillLineItem[]
  due_stage: string | null
  due_date: string | null
  payment_destination_type: BillPaymentDestinationType
  payment_destination_value: string
  payment_info_document_id: string | null
  status: BillStatus
  proof_document_id: string | null
  proof_uploaded_at: string | null
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  comments: ThreadComment[]
}

export interface BillSearchFilters {
  associate_id?: string
  branch_id?: string
  status?: string
  flow_direction?: string
}

export interface BillSummaryCount {
  status: BillStatus
  flow_direction: BillFlowDirection
  count: number
}

export interface BillSummary {
  counts: BillSummaryCount[]
}
