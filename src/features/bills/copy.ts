import type { BillFlowDirection } from '@/types'

/** Every bill-direction-dependent string in this feature goes through here - never
 * hardcode "Client pays" (or similar) at a call site, since a refund bill's copy
 * needs to say the opposite thing. */
export function billCopy(direction: BillFlowDirection) {
  const isRefund = direction === 'refund'
  return {
    actionLabel: isRefund ? 'Refund sent to bank' : 'Client pays',
    awaitingProofLabel: isRefund ? 'Awaiting refund confirmation' : 'Awaiting payment proof',
    overdueLabel: isRefund ? 'Refund follow-up overdue' : 'Payment follow-up overdue',
  }
}
