import type { PaymentMilestone } from '@/types'
import { post } from './client'

export interface PaymentMilestoneCreatePayload {
  label: string
  amount?: number | null
  percentage?: number | null
  due_stage?: string | null
}

export function createPaymentMilestone(
  caseId: string,
  payload: PaymentMilestoneCreatePayload,
): Promise<PaymentMilestone> {
  return post<PaymentMilestone>(`/cases/${caseId}/payment-milestones`, payload)
}
