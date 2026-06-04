import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useRole } from '../hooks/useRole'

// Route guard for authenticated users
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/auth/login" replace />
  return <>{children}</>
}

// Route guard for manager-only routes
export function ManagerOnly({ children }: { children: React.ReactNode }) {
  const { isManager } = useRole()
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/auth/login" replace />
  if (!isManager) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// Route guard for superadmin-only routes
export function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useRole()
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/auth/login" replace />
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
