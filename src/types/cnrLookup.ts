export interface CnrLookupResponse {
  status: 'fresh' | 'queued'
  case: Record<string, unknown> | null
  job_id?: string | null
}
