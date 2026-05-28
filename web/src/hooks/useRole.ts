import { useAuthStore } from '../store/authStore'

export function useRole() {
  const user = useAuthStore(s => s.user)
  return {
    isManager: user?.role === 'manager',
    isPlayer: user?.role === 'player',
    canLog: user?.role === 'manager',
    canCreate: user?.role === 'manager',
    playerId: user?.playerId,
  }
}
