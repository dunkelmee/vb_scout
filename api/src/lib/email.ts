const FROM = process.env.RESEND_FROM ?? 'courtside <onboarding@resend.dev>'
const APP  = process.env.APP_URL     ?? 'http://localhost:3004'

export type EmailLocale = 'en' | 'de'

function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require('resend') as typeof import('resend')
  return new Resend(process.env.RESEND_API_KEY)
}

function formatCode(code: string): string {
  return code.slice(0, 4) + ' · ' + code.slice(4)
}

function formatDate(d: Date, locale: EmailLocale): string {
  return d.toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Shared HTML shell so both languages render identically.
function shell(inner: string): string {
  return `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#070600;color:#F7F7FF;border-radius:16px;">
      <div style="font-size:22px;font-weight:800;color:#23B5D3;margin-bottom:8px;">courtside</div>
      ${inner}
    </div>
  `
}

function codeBox(label: string, code: string, validity: string): string {
  return `
    <div style="background:#161412;border:1px solid rgba(35,181,211,0.25);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:600;color:#23B5D3;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px;">${label}</div>
      <div style="font-size:32px;font-weight:800;color:#23B5D3;letter-spacing:0.18em;">${formatCode(code)}</div>
      <div style="font-size:11px;color:#4A4A5A;margin-top:10px;">${validity}</div>
    </div>
  `
}

function ctaButton(href: string, label: string): string {
  return `
    <a href="${href}" style="display:block;background:linear-gradient(135deg,#23B5D3,#279AF1);color:#000;font-weight:700;font-size:14px;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
      ${label}
    </a>
  `
}

export async function sendManagerInviteEmail(params: {
  to: string
  code: string
  expiresAt: Date
  invitedBy: string
  locale?: EmailLocale
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.log('[Email] RESEND_API_KEY not set — skipping manager invite email')
    return false
  }

  const locale = params.locale ?? 'de'
  const registerUrl = `${APP}/auth/register`

  const c = locale === 'de' ? {
    subject:   'Du wurdest zu courtside eingeladen',
    tagline:   'Volleyball-Analytics für dein Team',
    heading:   'Du wurdest eingeladen, ein Team auf courtside zu verwalten',
    body:      `${params.invitedBy} hat dich als <strong>Cheftrainer / Team-Manager</strong> eingeladen. Verwende den Code unten bei der Registrierung.`,
    codeLabel: 'Dein Einladungscode',
    validity:  `Gültig bis ${formatDate(params.expiresAt, locale)} · einmalig verwendbar`,
    cta:       'Konto erstellen →',
    footer:    `Gehe zu ${registerUrl}, gib deinen Einladungscode ein und schließe die Registrierung ab. Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren — der Code läuft automatisch ab.`,
  } : {
    subject:   'You have been invited to courtside',
    tagline:   'Volleyball analytics for your team',
    heading:   "You've been invited to manage a team on courtside",
    body:      `${params.invitedBy} has invited you to join as a <strong>Head Coach / Team Manager</strong>. Use the code below when registering.`,
    codeLabel: 'Your invitation code',
    validity:  `Valid until ${formatDate(params.expiresAt, locale)} · single use`,
    cta:       'Create your account →',
    footer:    `Go to ${registerUrl}, paste your invitation code, and complete your registration. If you did not expect this email you can ignore it — the code will expire automatically.`,
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: c.subject,
      html: shell(`
        <p style="color:#8A8A9A;font-size:14px;margin-bottom:28px;">${c.tagline}</p>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">${c.heading}</h2>
        <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">${c.body}</p>
        ${codeBox(c.codeLabel, params.code, c.validity)}
        ${ctaButton(registerUrl, c.cta)}
        <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">${c.footer}</p>
      `),
    })
    if (error) { console.error('[Resend] Manager invite email failed:', error); return false }
    return true
  } catch (err) {
    console.error('[Resend] Manager invite email failed:', err)
    return false
  }
}

export async function sendPlayerInviteEmail(params: {
  to: string
  code: string
  teamName: string
  expiresAt: Date
  invitedBy: string
  locale?: EmailLocale
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.log('[Email] RESEND_API_KEY not set — skipping player invite email')
    return false
  }

  const locale = params.locale ?? 'de'
  const registerUrl = `${APP}/auth/register`

  const c = locale === 'de' ? {
    subject:   `${params.invitedBy} hat dich zu ${params.teamName} auf courtside eingeladen`,
    tagline:   'Volleyball-Analytics für dein Team',
    heading:   `Du wurdest eingeladen, ${params.teamName} beizutreten`,
    body:      `${params.invitedBy} hat dich als <strong>Spieler</strong> eingeladen.`,
    codeLabel: 'Dein Einladungscode',
    validity:  `Gültig bis ${formatDate(params.expiresAt, locale)} · einmalig verwendbar`,
    cta:       'Konto erstellen →',
    footer:    `Gehe zu ${registerUrl} und gib den Einladungscode zur Registrierung ein. Falls du das nicht erwartet hast, kannst du diese E-Mail ignorieren.`,
  } : {
    subject:   `${params.invitedBy} invited you to join ${params.teamName} on courtside`,
    tagline:   'Volleyball analytics for your team',
    heading:   `You've been invited to join ${params.teamName}`,
    body:      `${params.invitedBy} has invited you to join as a <strong>Player</strong>.`,
    codeLabel: 'Your invitation code',
    validity:  `Valid until ${formatDate(params.expiresAt, locale)} · single use`,
    cta:       'Create your account →',
    footer:    `Go to ${registerUrl} and paste the invitation code to register. If you were not expecting this you can safely ignore it.`,
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: c.subject,
      html: shell(`
        <p style="color:#8A8A9A;font-size:14px;margin-bottom:28px;">${c.tagline}</p>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">${c.heading}</h2>
        <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">${c.body}</p>
        ${codeBox(c.codeLabel, params.code, c.validity)}
        ${ctaButton(registerUrl, c.cta)}
        <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">${c.footer}</p>
      `),
    })
    if (error) { console.error('[Resend] Player invite email failed:', error); return false }
    return true
  } catch (err) {
    console.error('[Resend] Player invite email failed:', err)
    return false
  }
}

export async function sendWelcomeEmail(params: {
  to: string
  firstName: string
  teamName: string
  role: 'manager' | 'player'
  locale?: EmailLocale
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.log('[Email] RESEND_API_KEY not set — skipping welcome email')
    return false
  }

  const locale = params.locale ?? 'de'
  const dashboardUrl = `${APP}/dashboard`

  const roleLabel = locale === 'de'
    ? (params.role === 'manager' ? 'Cheftrainer / Team-Manager' : 'Spieler')
    : (params.role === 'manager' ? 'Head Coach / Team Manager' : 'Player')

  const c = locale === 'de' ? {
    subject: `Willkommen bei courtside, ${params.firstName}!`,
    heading: `Willkommen, ${params.firstName}! 🏐`,
    body:    `Dein Konto wurde erstellt und du bist <strong style="color:#F7F7FF;">${params.teamName}</strong> als <strong>${roleLabel}</strong> beigetreten.`,
    cta:     'Zum Dashboard →',
    footer:  'Erfasse jeden Ballwechsel, jede Rotation und jeden Momentum-Wechsel — live auf dem Spielfeld.',
  } : {
    subject: `Welcome to courtside, ${params.firstName}!`,
    heading: `Welcome, ${params.firstName}! 🏐`,
    body:    `Your account has been created and you've joined <strong style="color:#F7F7FF;">${params.teamName}</strong> as a <strong>${roleLabel}</strong>.`,
    cta:     'Go to your dashboard →',
    footer:  'Track every rally, rotation, and momentum shift — live on the court.',
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: c.subject,
      html: shell(`
        <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">${c.heading}</h2>
        <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">${c.body}</p>
        ${ctaButton(dashboardUrl, c.cta)}
        <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">${c.footer}</p>
      `),
    })
    if (error) { console.error('[Resend] Welcome email failed:', error); return false }
    return true
  } catch (err) {
    console.error('[Resend] Welcome email failed:', err)
    return false
  }
}
