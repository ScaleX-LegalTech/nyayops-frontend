export interface User {
  id: string
  branch_id: string | null
  email: string
  full_name: string
  phone: string | null
  bio: string | null
  name_prefix: string | null
  name_suffix: string | null
  is_org_admin: boolean
  is_branch_admin: boolean
  is_active: boolean
  is_restricted: boolean
  email_notifications_enabled: boolean
  role_ids: string[]
}

export interface UserSearchFilters {
  limit?: number
  offset?: number
}

export interface UserPage {
  items: User[]
  has_more: boolean
}

export interface MyProfileUpdateRequest {
  full_name?: string | null
  phone?: string | null
  bio?: string | null
  email_notifications_enabled?: boolean
}

export interface Branch {
  id: string
  name: string
  is_frozen: boolean
  created_at: string
}

export interface Organization {
  id: string
  name: string
  is_frozen: boolean
  /** 'self' | 'platform_admin' | null - only a 'self' freeze can be self-unfrozen. */
  frozen_by: string | null
}

export interface BranchAdminPermissions {
  user_id: string
  full_name: string
  email: string
  branch_id: string | null
  branch_name: string | null
  case_reassignment: boolean
  fee_milestone_setting: boolean
  precedent_sharing: boolean
  invite_team_members: boolean
  document_access_full: boolean
}

export interface BranchAdminPermissionsUpdate {
  branch_id: string
  case_reassignment: boolean
  fee_milestone_setting: boolean
  precedent_sharing: boolean
  invite_team_members: boolean
  document_access_full: boolean
}

export interface Permission {
  resource: string
  action: string
  scope: string
  condition: Record<string, unknown> | null
  description: string | null
}

export interface Role {
  id: string
  name: string
  description: string | null
  name_prefix: string | null
  name_suffix: string | null
  permissions: Permission[]
}

export interface RolePreviewResponse {
  effective_permissions: Permission[]
  can_manage_documents: boolean
}
