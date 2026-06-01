import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useAuthStore(s => s.setUser)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !email || !password) return

    setError('')
    setLoading(true)
    try {
      const { user, accessToken } = await authApi.acceptInvite(token, email, password)
      setUser(user, accessToken)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 bg-background">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-turq-500 to-bell-500 flex items-center justify-center shadow-[0_4px_20px_rgba(35,181,211,0.4)]">
          <span className="text-pitch-950 font-display font-black text-2xl">VB</span>
        </div>
        <h1 className="font-display font-black text-2xl text-on-surface">Join your team</h1>
      </div>

      <div className="w-full max-w-sm">
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!searchParams.get('token') && (
              <Input
                label="Invite token"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Paste your invite token"
                required
              />
            )}
            <Input
              label="Your email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              label="Create password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="text-sm text-error bg-error-container/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={loading} fullWidth>Join team</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
