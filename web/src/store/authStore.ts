import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, AppUser, RegisterData } from '../lib/api'

interface AuthState {
  user: AppUser | null
  token: string | null
  login:    (email: string, password: string) => Promise<{ isFirstLogin: boolean }>
  register: (data: RegisterData) => Promise<{ isFirstLogin: boolean }>
  logout:   () => Promise<void>
  setUser:  (user: AppUser, token: string) => void
  refresh:  () => Promise<void>
  patchMe:  (data: { onboardingDone?: boolean; firstName?: string; lastName?: string }) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:  null,
      token: null,

      login: async (email, password) => {
        const { user, accessToken, isFirstLogin } = await authApi.login(email, password) as {
          user: AppUser; accessToken: string; isFirstLogin: boolean
        }
        set({ user, token: accessToken })
        return { isFirstLogin: isFirstLogin ?? false }
      },

      register: async (data) => {
        const res = await authApi.register(data)
        set({ user: res.user, token: res.accessToken })
        return { isFirstLogin: res.isFirstLogin ?? true }
      },

      logout: async () => {
        try { await authApi.logout() } catch {}
        set({ user: null, token: null })
      },

      setUser: (user, token) => set({ user, token }),

      refresh: async () => {
        try {
          const { accessToken } = await authApi.refresh()
          set(s => ({ ...s, token: accessToken }))
        } catch {
          set({ user: null, token: null })
        }
      },

      patchMe: async (data) => {
        const updated = await authApi.patchMe(data)
        const current = get().user
        if (current) set({ user: { ...current, ...updated } })
      },
    }),
    {
      name: 'vbscout-auth',
      partialize: state => ({ user: state.user, token: state.token }),
    }
  )
)
