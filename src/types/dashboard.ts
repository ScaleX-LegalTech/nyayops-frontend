import type { Case } from './cases'

export interface DashboardKpis {
  cases_today: number
  associate_activity: number
  overdue_cases: number
  pending_reviews: number
  scrutiny_action_required: number
}

export interface CasesByStatus {
  status: string
  count: number
}

export interface TopCourtMetric {
  court_jurisdiction: string
  count: number
}

export interface ActivityMetrics {
  active_users_today: number
  cases_in_progress: number
  notifications_sent: number
}

export interface Issue {
  id: string
  case_id: string
  issue_type: string
  description: string
  status: 'open' | 'resolved'
  raised_by: string
  routed_to: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
}

export interface PaymentMilestone {
  id: string
  case_id: string
  label: string
  amount: number | null
  percentage: number | null
  due_stage: string | null
  status: 'requested' | 'reminded' | 'received'
  created_by: string
  created_at: string
  updated_at: string
}

export interface MyWorkResponse {
  my_cases: Case[]
  open_issues: Issue[]
  upcoming_hearings: Case[]
  payment_follow_ups: PaymentMilestone[]
  overdue_cases: Case[]
}
