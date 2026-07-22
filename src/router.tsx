import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute, RequireManagingDirector, RequireManageRoles } from '@/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

const page = (loader: () => Promise<{ default: React.ComponentType }>) => ({
  lazy: async () => ({ Component: (await loader()).default }),
})

export const router = createBrowserRouter([
  { path: '/login', ...page(() => import('@/features/auth/LoginPage')) },
  { path: '/register', ...page(() => import('@/features/auth/RegisterPage')) },
  { path: '/accept-invite', ...page(() => import('@/features/auth/AcceptInvitePage')) },
  { path: '/verify-otp', ...page(() => import('@/features/auth/VerifyOtpPage')) },
  { path: '/forgot-password', ...page(() => import('@/features/auth/ForgotPasswordPage')) },
  { path: '/reset-password', ...page(() => import('@/features/auth/ResetPasswordPage')) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', ...page(() => import('@/features/dashboard/DashboardPage')) },
          { path: 'cases', ...page(() => import('@/features/cases/CasesPage')) },
          { path: 'cases/:caseId', ...page(() => import('@/features/cases/CaseDetailPage')) },
          {
            path: 'cases/:caseId/view-case-details',
            ...page(() => import('@/features/cases/CaseFullDetailsPage')),
          },
          {
            path: 'cases/:caseId/history',
            ...page(() => import('@/features/cases/CaseHistoryPage')),
          },
          {
            path: 'cases/:caseId/thread',
            ...page(() => import('@/features/cases/CaseThreadPage')),
          },
          { path: 'review', ...page(() => import('@/features/review/ReviewPage')) },
          { path: 'bills', ...page(() => import('@/features/bills/BillsPage')) },
          { path: 'bills/:billId/thread', ...page(() => import('@/features/bills/BillThreadPage')) },
          {
            path: 'cases/bills/:billId/thread',
            ...page(() => import('@/features/bills/BillThreadPage')),
          },
          { path: 'documents', ...page(() => import('@/features/documents/DocumentsPage')) },
          { path: 'chats', ...page(() => import('@/features/threads/InboxPage')) },
          { path: 'cause-list', ...page(() => import('@/features/causeList/CauseListPage')) },
          { path: 'cnr-lookup', ...page(() => import('@/features/cnrLookup/CnrLookupPage')) },
          {
            path: 'chats/cases/:caseId/thread',
            ...page(() => import('@/features/cases/CaseThreadPage')),
          },
          {
            path: 'chats/bills/:billId/thread',
            ...page(() => import('@/features/bills/BillThreadPage')),
          },
          { path: 'admin/users', ...page(() => import('@/features/admin/UsersPage')) },
          { path: 'audit', ...page(() => import('@/features/audit/AuditPage')) },
          { path: 'notifications', ...page(() => import('@/features/notifications/NotificationsPage')) },
          {
            path: 'settings',
            ...page(() => import('@/features/settings/SettingsPage')),
            children: [
              { index: true, ...page(() => import('@/features/settings/SettingsOverviewPage')) },
              { path: 'roles', ...page(() => import('@/features/admin/RolesPage')) },
              {
                element: <RequireManageRoles />,
                children: [
                  { path: 'roles/new', ...page(() => import('@/features/admin/RoleEditPage')) },
                  { path: 'roles/:roleId', ...page(() => import('@/features/admin/RoleEditPage')) },
                ],
              },
              {
                element: <RequireManagingDirector />,
                children: [
                  { path: 'branches', ...page(() => import('@/features/admin/BranchesPage')) },
                  {
                    path: 'branch-admins',
                    ...page(() => import('@/features/admin/BranchAdminsPage')),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
