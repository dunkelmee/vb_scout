const FROM = process.env.RESEND_FROM ?? 'courtside <onboarding@resend.dev>'
const APP  = process.env.APP_URL     ?? 'http://localhost:3004'

function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require('resend') as typeof import('resend')
  return new Resend(process.env.RESEND_API_KEY)
}

function formatCode(code: string): string {
  return code.slice(0, 4) + ' · ' + code.slice(4)
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export async function sendManagerInviteEmail(params: {
  to: string
  code: string
  expiresAt: Date
  invitedBy: string
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.log('[Email] RESEND_API_KEY not set — skipping manager invite email')
    return false
  }

  const registerUrl = `${APP}/auth/register`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: 'You have been invited to courtside',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#070600;color:#F7F7FF;border-radius:16px;">
          <div style="font-size:22px;font-weight:800;color:#23B5D3;margin-bottom:8px;">courtside</div>
          <p style="color:#8A8A9A;font-size:14px;margin-bottom:28px;">Volleyball analytics for your team</p>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">You've been invited to manage a team on courtside</h2>
          <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">
            ${params.invitedBy} has invited you to join as a <strong>Head Coach / Team Manager</strong>.
            Use the code below when registering.
          </p>
          <div style="background:#161412;border:1px solid rgba(35,181,211,0.25);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:600;color:#23B5D3;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px;">Your invitation code</div>
            <div style="font-size:32px;font-weight:800;color:#23B5D3;letter-spacing:0.18em;">${formatCode(params.code)}</div>
            <div style="font-size:11px;color:#4A4A5A;margin-top:10px;">Valid until ${formatDate(params.expiresAt)} · single use</div>
          </div>
          <a href="${registerUrl}" style="display:block;background:linear-gradient(135deg,#23B5D3,#279AF1);color:#000;font-weight:700;font-size:14px;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
            Create your account →
          </a>
          <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">
            Go to ${registerUrl}, paste your invitation code, and complete your registration.
            If you did not expect this email you can ignore it — the code will expire automatically.
          </p>
        </div>
      `,
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
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.log('[Email] RESEND_API_KEY not set — skipping player invite email')
    return false
  }

  const registerUrl = `${APP}/auth/register`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `${params.invitedBy} invited you to join ${params.teamName} on courtside`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#070600;color:#F7F7FF;border-radius:16px;">
          <div style="font-size:22px;font-weight:800;color:#23B5D3;margin-bottom:8px;">courtside</div>
          <p style="color:#8A8A9A;font-size:14px;margin-bottom:28px;">Volleyball analytics for your team</p>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">You've been invited to join ${params.teamName}</h2>
          <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">
            ${params.invitedBy} has invited you to join as a <strong>Player</strong>.
          </p>
          <div style="background:#161412;border:1px solid rgba(35,181,211,0.25);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:600;color:#23B5D3;text-transform:uppercase;letter-spacing:0.09em;margin-bottom:10px;">Your invitation code</div>
            <div style="font-size:32px;font-weight:800;color:#23B5D3;letter-spacing:0.18em;">${formatCode(params.code)}</div>
            <div style="font-size:11px;color:#4A4A5A;margin-top:10px;">Valid until ${formatDate(params.expiresAt)} · single use</div>
          </div>
          <a href="${registerUrl}" style="display:block;background:linear-gradient(135deg,#23B5D3,#279AF1);color:#000;font-weight:700;font-size:14px;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
            Create your account →
          </a>
          <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">
            Go to ${registerUrl} and paste the invitation code to register.
            If you were not expecting this you can safely ignore it.
          </p>
        </div>
      `,
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
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.log('[Email] RESEND_API_KEY not set — skipping welcome email')
    return false
  }

  const dashboardUrl = `${APP}/dashboard`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Welcome to courtside, ${params.firstName}!`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#070600;color:#F7F7FF;border-radius:16px;">
          <div style="font-size:22px;font-weight:800;color:#23B5D3;margin-bottom:8px;">courtside</div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Welcome, ${params.firstName}! 🏐</h2>
          <p style="color:#C8C8D8;font-size:14px;line-height:1.6;margin-bottom:24px;">
            Your account has been created and you've joined
            <strong style="color:#F7F7FF;">${params.teamName}</strong>
            as a <strong>${params.role === 'manager' ? 'Head Coach / Team Manager' : 'Player'}</strong>.
          </p>
          <a href="${dashboardUrl}" style="display:block;background:linear-gradient(135deg,#23B5D3,#279AF1);color:#000;font-weight:700;font-size:14px;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:20px;">
            Go to your dashboard →
          </a>
          <p style="color:#4A4A5A;font-size:12px;line-height:1.6;">
            Track every rally, rotation, and momentum shift — live on the court.
          </p>
        </div>
      `,
    })
    if (error) { console.error('[Resend] Welcome email failed:', error); return false }
    return true
  } catch (err) {
    console.error('[Resend] Welcome email failed:', err)
    return false
  }
}
