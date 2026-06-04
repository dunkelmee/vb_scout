import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    // Legacy token-based invite flow replaced by invite-code registration
    const code = searchParams.get('code') ?? searchParams.get('token') ?? ''
    navigate(`/auth/register${code ? `?code=${code}` : ''}`, { replace: true })
  }, [])

  return null
}
