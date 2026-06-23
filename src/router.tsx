import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute, RequireManagingDirector } from '@/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'

const page = (loader: () => Promise<{ default: React.ComponentType }>) => ({
  lazy: async () => ({ Component: (await loader()).default }),
})

export const router = createBrowserRouter([
  { path: '/login', ...page(() => import('@/features/auth/LoginPage')) },
  { path: '/register', ...page(() => import('@/features/auth/RegisterPage')) },
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
          { path: 'review', ...page(() => import('@/features/review/ReviewPage')) },
          { path: 'documents', ...page(() => import('@/features/documents/DocumentsPage')) },
          { path: 'admin/users', ...page(() => import('@/features/admin/UsersPage')) },
          { path: 'admin/roles', ...page(() => import('@/features/admin/RolesPage')) },
          {
            element: <RequireManagingDirector />,
            children: [
              { path: 'admin/branches', ...page(() => import('@/features/admin/BranchesPage')) },
            ],
          },
          { path: 'audit', ...page(() => import('@/features/audit/AuditPage')) },
          { path: 'settings', ...page(() => import('@/features/settings/SettingsPage')) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
