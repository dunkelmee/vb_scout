import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { invitesApi, InviteValidateResponse } from '../../lib/api'
import { Divider, GoogleButton, CourtSideLogo } from './LoginPage'

export function RegisterPage() {
  const { t } = useTranslation()
  const [inviteCode, setInviteCode]     = useState('')
  const [validation, setValidation]     = useState<InviteValidateResponse | null>(null)
  const [validating, setValidating]     = useState(false)
  const [firstName, setFirstName]       = useState('')
  const [lastName, setLastName]         = useState('')
  const [teamName, setTeamName]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [termsChecked, setTermsChecked] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  const register = useAuthStore(s => s.register)
  const navigate = useNavigate()
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const passwordStrength = (() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8)  score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return Math.min(score, 4)
  })()

  const normaliseCode = (raw: string) => raw.replace(/[\s·.]/g, '').toUpperCase()

  const validateCode = async (raw: string) => {
    const code = normaliseCode(raw)
    if (code.length < 8) { setValidation(null); return }
    setValidating(true)
    try {
      const result = await invitesApi.validate(code)
      setValidation(result)
      if (result.valid && result.teamName) setTeamName(result.teamName)
    } catch {
      setValidation({ valid: false, reason: 'error' })
    } finally {
      setValidating(false)
    }
  }

  const handleCodeChange = (val: string) => {
    setInviteCode(val)
    setValidation(null)
    if (validateTimer.current) clearTimeout(validateTimer.current)
    validateTimer.current = setTimeout(() => validateCode(val), 600)
  }

  const handleCodeBlur = () => {
    if (validateTimer.current) clearTimeout(validateTimer.current)
    validateCode(inviteCode)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validation?.valid) { setError(t('errors.invalidInviteCode')); return }
    if (!termsChecked) { setError(t('auth.register.acceptTerms')); return }
    if (password.length < 8) { setError(t('errors.passwordTooShort')); return }

    setError('')
    setLoading(true)
    try {
      const { isFirstLogin } = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        inviteCode: normaliseCode(inviteCode),
        teamName: teamName.trim() || undefined,
      })
      navigate(isFirstLogin ? '/onboarding' : '/dashboard', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.register.registrationFailed'))
    } finally {
      setLoading(false)
    }
  }

  const strengthColors = ['#4A4A5A', '#EA526F', '#279AF1', '#23B5D3', '#23B5D3']
  const strengthLabel  = ['', t('auth.register.pwWeak'), t('auth.register.pwFair'), t('auth.register.pwGood'), t('auth.register.pwStrong')][passwordStrength]

  return (
    <div className="relative min-h-dvh overflow-hidden" style={{ background: '#070600' }}>
      {/* Gradient hero */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at 88% 5%,  rgba(234,82,111,0.65) 0%, transparent 45%),
          radial-gradient(ellipse at 8%  88%, rgba(35,181,211,0.55) 0%, transparent 50%),
          radial-gradient(ellipse at 45% 50%, rgba(39,154,241,0.18) 0%, transparent 55%),
          #070600
        `,
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        opacity: 0.45,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
        backgroundSize: '160px', mixBlendMode: 'overlay',
      }} />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #070600)' }} />
      {/* Volleyball deco */}
      <svg
        className="absolute top-[10px] right-[-30px] pointer-events-none"
        width={200}
        height={200}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.20 }}
      >
        <defs>
          <linearGradient id="vb-grad-reg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#23B5D3" />
            <stop offset="100%" stopColor="#A2A2D0" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" stroke="url(#vb-grad-reg)" />
        <path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" stroke="url(#vb-grad-reg)" />
        <path d="M12 12a12.6 12.6 0 0 1-8.7 5" stroke="url(#vb-grad-reg)" />
        <path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" stroke="url(#vb-grad-reg)" />
        <path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" stroke="url(#vb-grad-reg)" />
        <path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" stroke="url(#vb-grad-reg)" />
      </svg>

      <div className="relative z-10 flex flex-col min-h-dvh">
        {/* Hero text */}
        <div className="px-7 pt-[20px]">
          <CourtSideLogo gradientId="logo-grad-reg" from="#23B5D3" to="#A2A2D0" className="mb-4" />
          <h1 className="text-[40px] font-black leading-[1.05] tracking-tight text-white mb-2.5">
            {t('auth.register.heroTitle1')}<br/>
            <span style={{ background: 'linear-gradient(135deg, #EA526F 0%, #23B5D3 55%, #279AF1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {t('auth.register.heroTitle2')}
            </span>
          </h1>
        </div>

        {/* Form */}
        <div className="mx-3.5 mt-4 mb-5 rounded-[20px] p-[22px_18px]" style={{
          background: 'rgba(22,20,18,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(247,247,255,0.08)',
        }}>
          <h2 className="text-[18px] font-bold text-white mb-0.5">{t('auth.register.title')}</h2>
          <p className="text-[12px] text-[#8A8A9A] mb-5">{t('auth.register.subtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Invite code — prominent */}
            <div className="rounded-[12px] p-3" style={{ background: 'rgba(35,181,211,0.06)', border: '1px solid rgba(35,181,211,0.25)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[15px]" style={{ color: '#23B5D3' }}>🔑</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: '#23B5D3' }}>{t('auth.register.inviteCode')}</span>
                {validating && <span className="text-[10px] text-[#8A8A9A] ml-auto">{t('common.loading')}</span>}
              </div>
              <input
                value={inviteCode}
                onChange={e => handleCodeChange(e.target.value)}
                onBlur={handleCodeBlur}
                placeholder={t('auth.register.inviteCodePlaceholder')}
                maxLength={9}
                className="w-full rounded-[8px] px-3 py-[10px] text-[16px] font-bold tracking-[0.18em] text-center uppercase outline-none"
                style={{
                  background: 'rgba(7,6,0,0.50)',
                  border: '1px solid rgba(35,181,211,0.30)',
                  color: '#23B5D3',
                  letterSpacing: '0.18em',
                }}
              />
              {validation && (
                <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-md" style={{
                  background: validation.valid ? 'rgba(35,181,211,0.08)' : 'rgba(234,82,111,0.08)',
                }}>
                  <span style={{ color: validation.valid ? '#23B5D3' : '#F07A90', fontSize: 13 }}>
                    {validation.valid ? '✓' : '✗'}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: validation.valid ? '#23B5D3' : '#F07A90' }}>
                    {validation.valid
                      ? `${t('auth.register.inviteValid', { teamName: validation.teamName ?? '—', role: validation.role === 'manager' ? t('teamSwitcher.roleManager') : t('teamSwitcher.rolePlayer') })} · ${validation.invitedBy}`
                      : t('auth.register.inviteInvalid')}
                  </span>
                </div>
              )}
            </div>

            {/* Role display (locked) */}
            {validation?.valid && (
              <div className="flex gap-2">
                <div className="flex-1 py-2.5 rounded-[9px] text-center text-[11px] font-semibold flex flex-col items-center gap-0.5"
                  style={{ background: 'rgba(35,181,211,0.12)', border: '1px solid rgba(35,181,211,0.40)', color: '#23B5D3' }}>
                  <span className="text-lg">{validation.role === 'manager' ? '🎯' : '🏐'}</span>
                  {validation.role === 'manager' ? t('teamSwitcher.roleManager') : t('teamSwitcher.rolePlayer')}
                </div>
                <div className="flex-1 py-2.5 rounded-[9px] text-center text-[11px] font-semibold flex flex-col items-center gap-0.5 opacity-40"
                  style={{ background: 'rgba(7,6,0,0.5)', border: '1px solid #2F2D28', color: '#8A8A9A' }}>
                  <span className="text-lg">{validation.role === 'manager' ? '🏐' : '🎯'}</span>
                  {validation.role === 'manager' ? t('teamSwitcher.rolePlayer') : t('teamSwitcher.roleManager')}
                </div>
              </div>
            )}

            {/* Team name (pre-filled or editable) */}
            <FieldGroup label={t('auth.register.teamName')}>
              <input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder={t('auth.register.teamName')}
                readOnly={!!(validation?.valid && validation.teamName)}
                className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
                style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28', opacity: (validation?.valid && validation.teamName) ? 0.6 : 1 }}
              />
            </FieldGroup>

            {/* Name */}
            <FieldGroup label={`${t('auth.register.firstName')} / ${t('auth.register.lastName')}`}>
              <div className="grid grid-cols-2 gap-2">
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t('auth.register.firstName')}
                  required className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
                  style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }} />
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t('auth.register.lastName')}
                  required className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
                  style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }} />
              </div>
            </FieldGroup>

            {/* Email */}
            <FieldGroup label={t('auth.login.emailLabel')}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.login.emailPlaceholder')}
                required className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
                style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }} />
            </FieldGroup>

            {/* Password + strength */}
            <FieldGroup label={t('auth.register.password')}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('auth.register.passwordHint')}
                required className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
                style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }} />
              {password && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="flex-1 h-[3px] rounded-sm transition-colors" style={{
                        background: i <= passwordStrength ? strengthColors[passwordStrength] : '#2F2D28'
                      }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: strengthColors[passwordStrength] }}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </FieldGroup>

            {/* Terms */}
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => setTermsChecked(!termsChecked)}
                className="w-[18px] h-[18px] rounded-[5px] flex-shrink-0 mt-0.5 flex items-center justify-center"
                style={{ background: 'rgba(35,181,211,0.15)', border: `1px solid ${termsChecked ? 'rgba(35,181,211,0.60)' : 'rgba(35,181,211,0.35)'}` }}>
                {termsChecked && <span className="text-[11px]" style={{ color: '#23B5D3' }}>✓</span>}
              </button>
              <p className="text-[11px] text-[#8A8A9A] leading-relaxed">
                {t('auth.register.terms', {
                  terms: t('auth.register.termsLink'),
                  privacy: t('auth.register.privacyLink'),
                })}
              </p>
            </div>

            {error && (
              <p className="text-[12px] text-[#F07A90] bg-[rgba(234,82,111,0.1)] rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading || !validation?.valid}
              className="w-full py-[14px] rounded-[12px] text-[14px] font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #EA526F, #23B5D3, #279AF1)', boxShadow: '0 4px 22px rgba(234,82,111,0.28)' }}>
              {loading ? '…' : `🚀 ${t('auth.register.createButton')}`}
            </button>
          </form>

          <Divider />
          <GoogleButton label={t('auth.register.googleButton')} />

          <p className="text-center text-[12px] text-[#8A8A9A] mt-4">
            {t('auth.register.alreadyAccount')}{' '}
            <Link to="/auth/login" className="text-[#23B5D3] font-semibold">{t('auth.register.signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8A8A9A] mb-1.5">{label}</label>
      {children}
    </div>
  )
}
