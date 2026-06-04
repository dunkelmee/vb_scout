import { useAuthStore } from '../store/authStore'

export function useRole() {
  const user = useAuthStore(s => s.user)
  const isSuperAdmin = user?.role === 'superadmin'
  const isManager    = user?.role === 'manager' || isSuperAdmin
  return {
    isSuperAdmin,
    isManager,
    isPlayer: user?.role === 'player',
    canLog: isManager,
    canCreate: isManager,
    playerId: user?.playerId,
  }
}
