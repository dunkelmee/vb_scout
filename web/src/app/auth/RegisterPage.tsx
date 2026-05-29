import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const register = useAuthStore(s => s.register)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !teamName) return
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setError('')
    setLoading(true)
    try {
      await register(email, password, teamName)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 bg-background">
      <div className="mb-8 flex flex-col items-center gap-2">
        <img src="/vb-icon.svg" alt="courtside" className="w-16 h-16" />
        <h1 className="font-harabara text-4xl tracking-wide text-on-surface">courtside</h1>
      </div>

      <div className="w-full max-w-sm">
        <div className="card p-6">
          <h2 className="font-display font-bold text-xl text-on-surface mb-1">Create your team</h2>
          <p className="text-sm text-on-surface-variant mb-6">You'll be set up as team manager.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Team name" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. VolleyElite" required />
            <Input label="Your email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coach@team.com" required />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required />

            {error && (
              <p className="text-sm text-error bg-error-container/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={loading} fullWidth className="mt-2">
              Create team
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-variant mt-4">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-orange hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
