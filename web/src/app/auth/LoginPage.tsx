import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 bg-background">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <img src="/vb-icon.svg" alt="courtside" className="w-16 h-16" />
        <h1 className="font-harabara text-4xl tracking-wide text-on-surface">courtside</h1>
        <p className="text-sm text-on-surface-variant">Volleyball Team Management</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="card p-6">
          <h2 className="font-display font-bold text-xl text-on-surface mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="coach@team.com"
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {error && (
              <p className="text-sm text-error bg-error-container/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={loading} fullWidth className="mt-2">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-variant mt-4">
          New team?{' '}
          <Link to="/auth/register" className="text-orange hover:underline font-medium">
            Create account
          </Link>
        </p>

        <p className="text-center text-sm text-on-surface-variant mt-2">
          Have an invite?{' '}
          <Link to="/auth/accept-invite" className="text-secondary-container hover:underline font-medium">
            Join team
          </Link>
        </p>
      </div>
    </div>
  )
}
