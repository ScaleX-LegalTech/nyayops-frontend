import type { BillCaseTypeCategory, BillFlowDirection, BillType } from '@/types'
import { get, post, toQuery } from './client'

export interface BillTypeCreatePayload {
  label: string
  case_type: BillCaseTypeCategory
  default_direction: BillFlowDirection
}

export function listBillTypes(caseType?: BillCaseTypeCategory): Promise<BillType[]> {
  return get<BillType[]>(`/bill-types${toQuery({ case_type: caseType })}`)
}

export function createBillType(payload: BillTypeCreatePayload): Promise<BillType> {
  return post<BillType>('/bill-types', payload)
}
