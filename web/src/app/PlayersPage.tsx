import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { playersApi, invitesApi, Player } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { PageHeader } from '../components/ui/AppShell'
import { Badge } from '../components/ui/Badge'
import { PlayerAvatar } from '../components/players/PlayerAvatar'
import { Plus, Edit3, Trash2, ShieldCheck, UserPlus, Copy, Check, X } from 'lucide-react'
import { cn } from '../components/ui/cn'

export function PlayersPage() {
  const { isManager } = useRole()
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [invitePlayer, setInvitePlayer] = useState<Player | null>(null)

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: playersApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  })

  const myPlayerId = user?.playerId

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title="Players"
        subtitle={`Active Roster · ${players.length} players`}
        right={isManager ? (
          <button
            onClick={() => navigate('/players/new')}
            className="w-9 h-9 rounded-full bg-turq-500 flex items-center justify-center shadow-[0_4px_16px_rgba(35,181,211,0.35),inset_0_1px_0_rgba(255,255,255,0.22)] active:scale-95 transition-transform"
          >
            <Plus size={16} className="text-pitch-950" />
          </button>
        ) : undefined}
      />

      {isLoading && (
        <div className="px-5 md:px-8 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="card h-16" />)}
        </div>
      )}

      <div className="px-5 md:px-8 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 pb-6">
        {players.map(player => {
          const isMe = player.userId === user?.id || player.id === myPlayerId
          const canViewFull = isManager || isMe

          return (
            <div
              key={player.id}
              className={cn(
                'card px-4 py-4 flex items-center gap-4',
                isMe && 'border-turq-500/20',
              )}
            >
              {/* Avatar with jersey badge */}
              <PlayerAvatar player={player} size="lg" showJerseyBadge />

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Name row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-display font-bold text-base text-on-surface leading-tight">
                    {player.firstName} {player.lastName}
                  </p>
                  {isMe && <Badge label="You" variant="info" size="sm" />}
                  {player.hasRefereeLicense && isManager && (
                    <ShieldCheck size={12} className="text-secondary-container" />
                  )}
                </div>

                {/* Positions — teal, uppercase, like the reference */}
                <p className="text-[11px] font-bold uppercase tracking-widest text-secondary-container mt-0.5 leading-tight">
                  {player.positions.join(' / ')}
                </p>

                {/* Height + birth year (manager only) */}
                {isManager && canViewFull && (player.heightM || player.birthday) && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    {[
                      player.heightM ? `${player.heightM}m` : null,
                      player.birthday ? new Date(player.birthday).getFullYear().toString() : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              {/* Actions — manager only */}
              {isManager && (
                <div className="flex items-center gap-1 shrink-0">
                  {!player.userId && (
                    <button
                      onClick={() => setInvitePlayer(player)}
                      className="p-2 rounded-full hover:bg-white/[0.06] text-turq-500/70"
                      title="Invite player"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/players/${player.id}`)}
                    className="p-2 rounded-full hover:bg-white/[0.06] text-on-surface-variant"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${player.firstName} ${player.lastName}?`)) {
                        deleteMutation.mutate(player.id)
                      }
                    }}
                    className="p-2 rounded-full hover:bg-white/[0.06] text-bubb-500/60"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {invitePlayer && (
        <InvitePlayerModal
          playerId={invitePlayer.id}
          playerName={`${invitePlayer.firstName} ${invitePlayer.lastName}`}
          onClose={() => setInvitePlayer(null)}
        />
      )}
    </div>
  )
}

function InvitePlayerModal({ playerId, playerName, onClose }: { playerId: string; playerName: string; onClose: () => void }) {
  const [boundEmail, setBoundEmail] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [result, setResult]         = useState<{ code: string; emailSent: boolean } | null>(null)
  const [copied, setCopied]         = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await invitesApi.create({ role: 'player', playerId, boundEmail: boundEmail.trim() || undefined })
      setResult({ code: res.code, emailSent: res.emailSent })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!result) return
    const code = result.code
    const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    try {
      await navigator.clipboard.writeText(code)
      markCopied()
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try { if (document.execCommand('copy')) markCopied() } finally { document.body.removeChild(ta) }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-8"
      style={{ background: 'rgba(7,6,0,0.70)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-[20px] p-6 relative" style={{ background: 'rgba(22,20,18,0.98)', border: '1px solid rgba(247,247,255,0.10)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full text-[#8A8A9A] hover:text-white" style={{ background: 'rgba(247,247,255,0.06)' }}>
          <X size={15} />
        </button>

        {result ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(35,181,211,0.15)' }}>
              <Check size={22} style={{ color: '#23B5D3' }} />
            </div>
            <h3 className="text-[16px] font-bold text-white mb-1">Invite code ready</h3>
            <p className="text-[12px] text-[#8A8A9A] mb-4">Share this code with the player so they can register.</p>
            <div className="flex items-center gap-2 rounded-[12px] p-3 mb-3" style={{ background: 'rgba(35,181,211,0.08)', border: '1px solid rgba(35,181,211,0.25)' }}>
              <span className="flex-1 font-bold tracking-[0.20em] text-[18px] text-center" style={{ color: '#23B5D3' }}>
                {result.code.slice(0, 4)}·{result.code.slice(4)}
              </span>
              <button onClick={copy} className="p-2 rounded-lg" style={{ color: copied ? '#23B5D3' : '#8A8A9A' }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            {result.emailSent && (
              <p className="text-[11px] text-[#23B5D3]">Invite email sent to {boundEmail}</p>
            )}
          </div>
        ) : (
          <>
            <h3 className="text-[16px] font-bold text-white mb-0.5">Invite {playerName}</h3>
            <p className="text-[12px] text-[#8A8A9A] mb-4">Generate a one-time code for {playerName} to register and join your team.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8A8A9A] mb-1.5">Player email (optional)</label>
                <input
                  type="email"
                  value={boundEmail}
                  onChange={e => setBoundEmail(e.target.value)}
                  placeholder="player@club.de"
                  className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
                  style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }}
                />
                <p className="text-[10px] text-[#4A4A5A] mt-1">If provided, the code is locked to this email and an invite is sent automatically.</p>
              </div>
              {error && <p className="text-[12px] text-[#F07A90]">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-[13px] rounded-[12px] text-[14px] font-bold text-black disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #23B5D3, #279AF1)' }}>
                {loading ? '…' : '🔑 Generate invite code'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
