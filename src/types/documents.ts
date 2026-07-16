export interface DocumentVersion {
  id: string
  version_number: number
  storage_key: string
  mime_type: string
  file_size_bytes: number
  change_note: string | null
  uploaded_by: string
  uploaded_by_name: string
  uploaded_at: string
  virus_scan_status: string
  metadata: Record<string, unknown>
}

export interface DocumentRecord {
  id: string
  branch_id: string | null
  case_id: string
  title: string
  doc_type: string
  uploaded_by: string
  uploaded_by_name: string
  is_quarantined: boolean
  is_sealed: boolean
  metadata: Record<string, unknown>
  versions: DocumentVersion[]
}

// Slim latest-version shape for list/card views - matches DocumentVersionSummary
// on the backend.
export interface DocumentVersionSummary {
  id: string
  version_number: number
  storage_key: string
  mime_type: string
  file_size_bytes: number
  uploaded_at: string
  virus_scan_status: string
}

// Slim document shape for list views (GET /documents) - matches DocumentCard on
// the backend. Full version history (DocumentRecord) is only fetched on demand,
// when a row is expanded.
export interface DocumentCard {
  id: string
  case_id: string
  case_title: string
  title: string
  doc_type: string
  is_quarantined: boolean
  is_sealed: boolean
  uploaded_by_name: string
  version_count: number
  first_version_uploaded_at: string | null
  latest_version: DocumentVersionSummary | null
}

export interface DocumentUploadResponse {
  document_id: string
  version_id: string
  upload_url: string
}

export interface DocumentSearchFilters {
  case_id?: string
  doc_type?: string
  title?: string
  uploaded_by?: string
}
