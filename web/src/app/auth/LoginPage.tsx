import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const login    = useAuthStore(s => s.login)
  const navigate = useNavigate()

  const [showLoader, setShowLoader] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setError('')
    setLoading(true)
    try {
      const { isFirstLogin } = await login(email, password)
      const dest = isFirstLogin ? '/onboarding' : '/dashboard'
      setShowLoader(true)
      setTimeout(() => navigate(dest, { replace: true }), 900)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden" style={{ background: '#070600' }}>
      {/* Gradient hero */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 80% 5%,  rgba(35,181,211,0.60) 0%, transparent 50%),
          radial-gradient(ellipse at 10% 85%, rgba(39,154,241,0.50) 0%, transparent 50%),
          #070600
        `,
      }} />
      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.45,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
        backgroundSize: '160px',
        mixBlendMode: 'overlay',
      }} />
      {/* Fade to bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none" style={{
        background: 'linear-gradient(to bottom, transparent, #070600)',
      }} />
      {/* Volleyball deco */}
      <svg className="absolute top-[10px] right-[-30px] w-[200px] h-[200px] pointer-events-none" style={{ opacity: 0.07 }} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="white" strokeWidth="1.5"/>
        <circle cx="100" cy="100" r="60" stroke="white" strokeWidth="1"/>
        <path d="M100 10 Q160 60 100 100 Q40 140 100 190" stroke="white" strokeWidth="1.2" fill="none"/>
        <path d="M10 100 Q60 40 100 100 Q140 160 190 100" stroke="white" strokeWidth="1.2" fill="none"/>
        <line x1="100" y1="10" x2="100" y2="190" stroke="white" strokeWidth="0.5" opacity="0.6"/>
      </svg>

      {/* Post-login loading overlay */}
      {showLoader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: '#070600' }}>
          <img src="/loading2.svg" alt="Loading" className="w-48 h-48" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-dvh">
        {/* Hero text */}
        <div className="px-7 pt-[50px]">
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase text-white/45 mb-3">courtside</p>
          <div className="inline-flex items-center gap-1.5 bg-[rgba(35,181,211,0.12)] border border-[rgba(35,181,211,0.25)] rounded-full px-3 py-1 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#23B5D3]">Volleyball analytics</span>
          </div>
          <h1 className="text-[40px] font-black leading-[1.05] tracking-tight text-white mb-2.5">
            Play smarter.<br/>
            <span style={{ background: 'linear-gradient(135deg, #23B5D3 0%, #279AF1 55%, #EA526F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Win more.
            </span>
          </h1>
          <p className="text-[13px] text-white/50 leading-relaxed max-w-[280px]">
            Manage your team and track every point — live on the court.
          </p>
        </div>

        {/* Form panel */}
        <div className="mx-3.5 mt-6 mb-5 rounded-[20px] p-[22px_18px]" style={{
          background: 'rgba(22,20,18,0.72)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(247,247,255,0.08)',
        }}>
          <h2 className="text-[18px] font-bold text-white mb-0.5">Welcome back</h2>
          <p className="text-[12px] text-[#8A8A9A] mb-5">Sign in to your team account</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <AuthField icon="✉" label="Email" type="email" value={email} onChange={setEmail} placeholder="coach@volleyclub.de" />
            <AuthField icon="🔒" label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

            <p className="text-[11px] text-[#23B5D3] text-right -mt-1 cursor-pointer">Forgot password?</p>

            {error && (
              <p className="text-[12px] text-[#F07A90] bg-[rgba(234,82,111,0.1)] rounded-lg px-3 py-2">{error}</p>
            )}

            <AuthButton loading={loading} gradient="linear-gradient(135deg, #23B5D3, #279AF1)" shadow="rgba(35,181,211,0.30)">
              Sign in
            </AuthButton>
          </form>

          <Divider />

          <GoogleButton label="Continue with Google" />

          <p className="text-center text-[12px] text-[#8A8A9A] mt-4">
            No account yet?{' '}
            <Link to="/auth/register" className="text-[#23B5D3] font-semibold">Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function AuthField({
  label, type, value, onChange, placeholder,
}: {
  icon: string; label: string; type: string; value: string
  onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8A8A9A] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
        style={{
          background: 'rgba(7,6,0,0.60)',
          border: '1px solid #2F2D28',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(35,181,211,0.50)')}
        onBlur={e => (e.currentTarget.style.borderColor = '#2F2D28')}
      />
    </div>
  )
}

function AuthButton({ children, loading, gradient, shadow }: {
  children: React.ReactNode; loading?: boolean; gradient: string; shadow: string
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-[14px] rounded-[12px] text-[14px] font-bold text-black flex items-center justify-center gap-2 disabled:opacity-60"
      style={{ background: gradient, boxShadow: `0 4px 22px ${shadow}` }}
    >
      {loading ? '…' : children}
    </button>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-2.5 my-4 text-[11px] text-[#4A4A5A]">
      <div className="flex-1 h-px bg-[#2F2D28]" />
      or continue with
      <div className="flex-1 h-px bg-[#2F2D28]" />
    </div>
  )
}

function GoogleButton({ label, onClick }: { label: string; onClick?: () => void }) {
  const [toastVisible, setToastVisible] = React.useState(false)

  const handleClick = () => {
    onClick?.()
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full py-[11px] rounded-[12px] text-[13px] font-medium text-white flex items-center justify-center gap-2"
        style={{ background: 'rgba(7,6,0,0.5)', border: '1px solid #2F2D28' }}
      >
        <GoogleIcon />
        {label}
      </button>
      {toastVisible && (
        <p className="text-center text-[11px] text-[#8A8A9A] mt-2">
          Google sign-in is coming soon. Please use email and password for now.
        </p>
      )}
    </>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export { AuthField, AuthButton, Divider, GoogleButton, GoogleIcon }
