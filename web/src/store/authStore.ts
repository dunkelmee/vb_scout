import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, AppUser } from '../lib/api'

interface AuthState {
  user: AppUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, teamName: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: AppUser, token: string) => void
  refresh: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (email: string, password: string) => {
        const { user, accessToken } = await authApi.login(email, password)
        set({ user, token: accessToken })
      },

      register: async (email: string, password: string, teamName: string) => {
        const { user, accessToken } = await authApi.register(email, password, teamName)
        set({ user, token: accessToken })
      },

      logout: async () => {
        try { await authApi.logout() } catch {}
        set({ user: null, token: null })
      },

      setUser: (user: AppUser, token: string) => set({ user, token }),

      refresh: async () => {
        try {
          const { accessToken } = await authApi.refresh()
          set((s) => ({ ...s, token: accessToken }))
        } catch {
          set({ user: null, token: null })
        }
      },
    }),
    {
      name: 'vbscout-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
)
