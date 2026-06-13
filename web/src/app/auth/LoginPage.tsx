import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export function LoginPage() {
  const { t } = useTranslation()
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
      setError(err instanceof Error ? err.message : t('auth.login.loginFailed'))
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
          <linearGradient id="vb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF77AA" />
            <stop offset="100%" stopColor="#A2A2D0" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" stroke="url(#vb-grad)" />
        <path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" stroke="url(#vb-grad)" />
        <path d="M12 12a12.6 12.6 0 0 1-8.7 5" stroke="url(#vb-grad)" />
        <path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" stroke="url(#vb-grad)" />
        <path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" stroke="url(#vb-grad)" />
        <path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" stroke="url(#vb-grad)" />
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
          <CourtSideLogo gradientId="logo-grad-login" from="#FF77AA" to="#A2A2D0" className="mb-4" />
          <h1 className="text-[40px] font-black leading-[1.05] tracking-tight text-white mb-2.5">
            {t('auth.login.heroTitle1')}<br/>
            <span style={{ background: 'linear-gradient(135deg, #23B5D3 0%, #279AF1 55%, #EA526F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {t('auth.login.heroTitle2')}
            </span>
          </h1>
          <p className="text-[13px] text-white/50 leading-relaxed max-w-[280px]">
            {t('auth.login.heroSubtitle')}
          </p>
        </div>

        {/* Form panel */}
        <div className="mx-3.5 mt-6 mb-5 rounded-[20px] p-[22px_18px]" style={{
          background: 'rgba(22,20,18,0.72)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(247,247,255,0.08)',
        }}>
          <h2 className="text-[18px] font-bold text-white mb-0.5">{t('auth.login.title')}</h2>
          <p className="text-[12px] text-[#8A8A9A] mb-5">{t('auth.login.subtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <AuthField icon="✉" label={t('auth.login.emailLabel')} type="email" value={email} onChange={setEmail} placeholder={t('auth.login.emailPlaceholder')} />
            <AuthField icon="🔒" label={t('auth.login.passwordLabel')} type="password" value={password} onChange={setPassword} placeholder="••••••••" />

            <p className="text-[11px] text-[#23B5D3] text-right -mt-1 cursor-pointer">{t('auth.login.forgotPassword')}</p>

            {error && (
              <p className="text-[12px] text-[#F07A90] bg-[rgba(234,82,111,0.1)] rounded-lg px-3 py-2">{error}</p>
            )}

            <AuthButton loading={loading} gradient="linear-gradient(135deg, #23B5D3, #279AF1)" shadow="rgba(35,181,211,0.30)">
              {t('auth.login.signIn')}
            </AuthButton>
          </form>

          <Divider />

          <GoogleButton label={t('auth.login.googleButton')} />

          <p className="text-center text-[12px] text-[#8A8A9A] mt-4">
            {t('auth.login.noAccount')}{' '}
            <Link to="/auth/register" className="text-[#23B5D3] font-semibold">{t('auth.login.createOne')}</Link>
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
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2.5 my-4 text-[11px] text-[#4A4A5A]">
      <div className="flex-1 h-px bg-[#2F2D28]" />
      {t('auth.login.orContinue')}
      <div className="flex-1 h-px bg-[#2F2D28]" />
    </div>
  )
}

function GoogleButton({ label, onClick }: { label: string; onClick?: () => void }) {
  const { t } = useTranslation()
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
          {t('auth.login.googleSoon')}
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

export function CourtSideLogo({ gradientId, from, to, className }: {
  gradientId: string; from: string; to: string; className?: string
}) {
  const fill = `url(#${gradientId})`
  return (
    <svg width="93" height="16" viewBox="0 0 93 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <path d="M6 4.81934C7.13329 4.81934 8.11998 5.06008 8.95996 5.54004C9.79995 6.0067 10.4203 6.67959 10.8203 7.55957L8.40039 8.85938C8.12045 8.35287 7.76735 7.97924 7.34082 7.73926C6.92752 7.49928 6.47376 7.3799 5.98047 7.37988C5.44714 7.37988 4.96671 7.49926 4.54004 7.73926C4.11342 7.97925 3.77382 8.3198 3.52051 8.75977C3.28056 9.1997 3.16018 9.73283 3.16016 10.3594C3.16016 10.986 3.28051 11.52 3.52051 11.96C3.77376 12.3997 4.11361 12.7396 4.54004 12.9795C4.96671 13.2195 5.44714 13.3398 5.98047 13.3398C6.47376 13.3398 6.92752 13.2266 7.34082 13C7.7674 12.76 8.12043 12.3793 8.40039 11.8594L10.8203 13.1797C10.4203 14.0463 9.79993 14.7192 8.95996 15.1992C8.11999 15.6658 7.13327 15.8994 6 15.8994C4.84014 15.8994 3.80697 15.6658 2.90039 15.1992C1.99388 14.7193 1.2807 14.0596 0.760742 13.2197C0.254076 12.3797 0 11.426 0 10.3594C3.45936e-05 9.27952 0.254159 8.32658 0.760742 7.5C1.28071 6.66005 1.99379 6.0067 2.90039 5.54004C3.80697 5.06009 4.84014 4.81938 6 4.81934Z" fill={fill}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M17.2002 4.81934C18.3335 4.81936 19.3469 5.06006 20.2402 5.54004C21.1333 6.00666 21.8332 6.65301 22.3398 7.47949C22.8465 8.3061 23.0996 9.26613 23.0996 10.3594C23.0996 11.426 22.8465 12.3797 22.3398 13.2197C21.8332 14.0463 21.1334 14.6997 20.2402 15.1797C19.3469 15.6597 18.3335 15.8994 17.2002 15.8994C16.0535 15.8994 15.033 15.6597 14.1396 15.1797C13.2598 14.6997 12.56 14.0463 12.04 13.2197C11.5334 12.3797 11.2803 11.426 11.2803 10.3594C11.2803 9.27959 11.5335 8.32654 12.04 7.5C12.5599 6.66016 13.2599 6.00669 14.1396 5.54004C15.033 5.06004 16.0535 4.81934 17.2002 4.81934ZM17.2002 7.37988C16.6802 7.37988 16.2131 7.49926 15.7998 7.73926C15.3865 7.97926 15.0531 8.31978 14.7998 8.75977C14.5599 9.19967 14.4405 9.73291 14.4404 10.3594C14.4404 10.9727 14.5598 11.5066 14.7998 11.96C15.0531 12.3998 15.3866 12.7395 15.7998 12.9795C16.2131 13.2195 16.6802 13.3398 17.2002 13.3398C17.72 13.3398 18.1864 13.2194 18.5996 12.9795C19.0129 12.7395 19.3401 12.3998 19.5801 11.96C19.8201 11.5066 19.9404 10.9727 19.9404 10.3594C19.9404 9.73287 19.82 9.19969 19.5801 8.75977C19.3401 8.31977 19.0129 7.97926 18.5996 7.73926C18.1864 7.49946 17.7199 7.37991 17.2002 7.37988Z" fill={fill}/>
      <path d="M27.8457 10.5996C27.8457 11.4929 28.0319 12.1534 28.4053 12.5801C28.7919 12.9933 29.3322 13.1992 30.0254 13.1992C30.5054 13.1992 30.9323 13.0994 31.3057 12.8994C31.6789 12.6861 31.9723 12.366 32.1855 11.9395C32.3988 11.4995 32.5058 10.953 32.5059 10.2998V4.97949H35.626V15.7393H32.665V14.4746C32.3703 14.8238 32.0187 15.1137 31.6055 15.3398C30.9122 15.7131 30.1518 15.8994 29.3252 15.8994C28.4321 15.8994 27.6323 15.7264 26.9258 15.3799C26.2325 15.0333 25.6923 14.5064 25.3057 13.7998C24.919 13.0798 24.7256 12.1662 24.7256 11.0596V4.97949H27.8457V10.5996Z" fill={fill}/>
      <path d="M48.3311 4.97949H50.9902V7.37988H48.3311V12C48.3311 12.4531 48.4443 12.8063 48.6709 13.0596C48.9108 13.2994 49.2372 13.4199 49.6504 13.4199C50.1437 13.4199 50.5707 13.2862 50.9307 13.0195L51.751 15.2197C51.431 15.4464 51.0441 15.6193 50.5908 15.7393C50.1508 15.8459 49.6971 15.8994 49.2305 15.8994C47.9506 15.8994 46.9576 15.5794 46.251 14.9395C45.5577 14.2862 45.211 13.3198 45.2109 12.04V7.42383C42.8651 7.5597 42.4576 7.99056 42.0156 8.39941C41.4958 8.87935 41.2364 9.63279 41.2363 10.6592V15.7393H38.1162V4.97949H41.0957V6.39453C41.3898 5.99305 41.7627 5.6679 42.2158 5.41992C42.9225 5.01992 43.6664 4.81934 45.2109 4.81934V2.59961H48.3311V4.97949Z" fill={fill}/>
      <path d="M57.3125 4.81934C58.0458 4.81934 58.7928 4.89959 59.5527 5.05957C60.3127 5.21957 60.9465 5.4531 61.4531 5.75977L60.4131 7.97949C59.8931 7.67285 59.3663 7.46605 58.833 7.35938C58.313 7.23937 57.8058 7.17969 57.3125 7.17969C56.6193 7.17972 56.1129 7.27333 55.793 7.45996C55.473 7.64662 55.3125 7.88638 55.3125 8.17969C55.3125 8.44631 55.4267 8.64598 55.6533 8.7793C55.8933 8.91256 56.2063 9.01964 56.5928 9.09961C56.9793 9.17959 57.3993 9.25268 57.8525 9.31934C58.3192 9.37267 58.7863 9.46008 59.2529 9.58008C59.7195 9.70006 60.1394 9.87301 60.5127 10.0996C60.8994 10.3129 61.2131 10.6133 61.4531 11C61.6929 11.3733 61.8125 11.8664 61.8125 12.4795C61.8125 13.1462 61.6129 13.7398 61.2129 14.2598C60.8129 14.7664 60.2326 15.1666 59.4727 15.46C58.726 15.7532 57.8123 15.8994 56.7324 15.8994C55.8127 15.8994 54.9263 15.7933 54.0732 15.5801C53.2333 15.3534 52.5666 15.0726 52.0732 14.7393L53.1133 12.5C53.6064 12.8065 54.1862 13.0598 54.8525 13.2598C55.5324 13.4464 56.1993 13.54 56.8525 13.54C57.5725 13.54 58.0797 13.4526 58.373 13.2793C58.6795 13.106 58.833 12.8661 58.833 12.5596C58.833 12.3063 58.7126 12.12 58.4727 12C58.246 11.8667 57.9394 11.7659 57.5527 11.6992C57.1661 11.6326 56.7391 11.5667 56.2725 11.5C55.8192 11.4333 55.3591 11.3459 54.8926 11.2393C54.4262 11.1193 53.9998 10.9462 53.6133 10.7197C53.2267 10.4931 52.9128 10.1864 52.6729 9.7998C52.4462 9.41318 52.333 8.91304 52.333 8.2998C52.333 7.61987 52.5265 7.01997 52.9131 6.5C53.3131 5.98 53.8861 5.57263 54.6328 5.2793C55.3794 4.97268 56.2727 4.81937 57.3125 4.81934Z" fill={fill}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M79.9131 15.7393H76.9336V14.4941C76.6642 14.8196 76.3514 15.0891 75.9932 15.2998C75.3266 15.6997 74.5198 15.8994 73.5732 15.8994C72.56 15.8994 71.6463 15.673 70.833 15.2197C70.0198 14.7531 69.3735 14.1059 68.8936 13.2793C68.427 12.4527 68.1934 11.4793 68.1934 10.3594C68.1934 9.22623 68.427 8.24649 68.8936 7.41992C69.3735 6.59343 70.0199 5.95332 70.833 5.5C71.6463 5.0467 72.56 4.81937 73.5732 4.81934C74.4799 4.81934 75.2732 5.01997 75.9531 5.41992C76.2664 5.60419 76.5458 5.83349 76.7939 6.10547V0.899414H79.9131V15.7393ZM74.1133 7.37988C73.5935 7.37991 73.127 7.49946 72.7139 7.73926C72.3005 7.97925 71.9672 8.31979 71.7139 8.75977C71.4739 9.19971 71.3535 9.7328 71.3535 10.3594C71.3535 10.9727 71.4739 11.5066 71.7139 11.96C71.9672 12.3997 72.3007 12.7396 72.7139 12.9795C73.1271 13.2194 73.5935 13.3398 74.1133 13.3398C74.6199 13.3398 75.0799 13.2194 75.4932 12.9795C75.9064 12.7395 76.2336 12.3999 76.4736 11.96C76.727 11.5066 76.8535 10.9727 76.8535 10.3594C76.8535 9.7329 76.7269 9.19968 76.4736 8.75977C76.2336 8.31977 75.9065 7.97926 75.4932 7.73926C75.0799 7.49941 74.6198 7.37988 74.1133 7.37988Z" fill={fill}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M87.3613 4.81934C88.3746 4.81936 89.3017 5.03332 90.1416 5.45996C90.9813 5.88659 91.6546 6.50626 92.1611 7.31934C92.6678 8.13267 92.9209 9.1131 92.9209 10.2598L84.9639 11.7988C84.9884 11.8536 85.0135 11.9078 85.041 11.96C85.2943 12.4398 85.6545 12.8001 86.1211 13.04C86.6011 13.28 87.168 13.3994 87.8213 13.3994C88.3946 13.3994 88.8947 13.313 89.3213 13.1396C89.7479 12.9663 90.1482 12.706 90.5215 12.3594L92.1807 14.1592C91.6873 14.7192 91.068 15.1533 90.3213 15.46C89.5746 15.7533 88.7145 15.8994 87.7412 15.8994C86.5145 15.8994 85.4343 15.6597 84.501 15.1797C83.5811 14.6997 82.868 14.0463 82.3613 13.2197C81.8547 12.3797 81.6016 11.426 81.6016 10.3594C81.6016 9.27966 81.8477 8.32651 82.3408 7.5C82.8475 6.66 83.5347 6.00671 84.4014 5.54004C85.268 5.06004 86.2547 4.81934 87.3613 4.81934ZM87.3613 7.17969C86.828 7.17969 86.3547 7.30004 85.9414 7.54004C85.5414 7.76671 85.2276 8.10624 85.001 8.55957C84.7922 8.96491 84.6805 9.45521 84.6641 10.0303L89.9072 9.02441C89.8519 8.83093 89.7767 8.64902 89.6807 8.47949C89.4541 8.07971 89.141 7.76664 88.7412 7.54004C88.3546 7.30007 87.8946 7.17972 87.3613 7.17969Z" fill={fill}/>
      <path d="M66.458 15.7393H63.3379V4.97949H66.458V15.7393Z" fill={fill}/>
      <path d="M64.8975 0C65.4708 0 65.9379 0.159522 66.2979 0.479492C66.6579 0.786159 66.8379 1.18635 66.8379 1.67969C66.8379 2.19962 66.6578 2.63285 66.2979 2.97949C65.9512 3.31283 65.4841 3.47949 64.8975 3.47949C64.3243 3.47942 63.858 3.31272 63.498 2.97949C63.138 2.64616 62.958 2.23259 62.958 1.73926C62.9581 1.24612 63.1382 0.833242 63.498 0.5C63.858 0.166742 64.3243 7.54033e-05 64.8975 0Z" fill={fill}/>
    </svg>
  )
}

export { AuthField, AuthButton, Divider, GoogleButton, GoogleIcon }
