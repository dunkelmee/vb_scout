import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, invitesApi, AdminTeam, AdminInvite } from '../../lib/api'
import { PageHeader } from '../../components/ui/AppShell'
import {
  Plus, Copy, Trash2, Mail, Users, Trophy, ChevronDown, ChevronUp, X, Check,
} from 'lucide-react'

export function AdminTeamsPage() {
  const qc = useQueryClient()

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: adminApi.teams,
  })

  const { data: allInvites = [] } = useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: adminApi.invites,
  })

  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [showNewTeam, setShowNewTeam]       = useState(false)
  const [inviteTeam, setInviteTeam]         = useState<AdminTeam | null>(null)
  const [deleteTeam, setDeleteTeam]         = useState<AdminTeam | null>(null)

  const deleteTeamMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteTeam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'teams'] })
      qc.invalidateQueries({ queryKey: ['admin', 'invites'] })
      setDeleteTeam(null)
    },
  })

  const revokeInvite = useMutation({
    mutationFn: (id: string) => invitesApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'invites'] }),
  })

  const resendInvite = useMutation({
    mutationFn: (id: string) => invitesApi.resend(id),
  })

  const teamInvites = (teamId: string) =>
    allInvites.filter(inv => inv.teamId === teamId)

  if (teamsLoading) return <AdminTeamsSkeleton />

  return (
    <div className="min-h-dvh" style={{ background: '#0B0A08' }}>
      <PageHeader
        title="Teams"
        subtitle="Superadmin"
        right={
          <button
            onClick={() => setShowNewTeam(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-bold text-black"
            style={{ background: 'linear-gradient(135deg, #23B5D3, #279AF1)' }}
          >
            <Plus size={14} />
            New team
          </button>
        }
      />

      <div className="px-5 md:px-8 space-y-3 pb-8">
        {teams.length === 0 && (
          <div className="text-center py-16 text-[#8A8A9A] text-sm">
            No teams yet. Create the first one.
          </div>
        )}

        {teams.map(team => {
          const invites = teamInvites(team.id)
          const isExpanded = expandedTeamId === team.id
          const activeInvites = invites.filter(i => !i.isExpired && !i.isFullyUsed)

          return (
            <div key={team.id} className="rounded-[16px] overflow-hidden"
              style={{ background: 'rgba(22,20,18,0.80)', border: '1px solid rgba(247,247,255,0.07)' }}>
              {/* Team header row */}
              <div className="flex items-center gap-3 p-4">
                {/* Initials badge */}
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[13px] font-black text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #23B5D3 0%, #279AF1 100%)' }}>
                  {team.initials ?? team.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-white truncate">{team.name}</p>
                  {team.activeSeason && (
                    <p className="text-[11px] text-[#8A8A9A] truncate">{team.activeSeason.name}</p>
                  )}
                </div>

                {/* Stats chips */}
                <div className="flex items-center gap-2 shrink-0">
                  <Chip icon={<Users size={10} />} value={team.memberCount} label="members" color="#23B5D3" />
                  <Chip icon={<Trophy size={10} />} value={team.matchCount} label="games" color="#EA526F" />
                </div>

                <button
                  onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                  className="p-1.5 rounded-lg text-[#8A8A9A] hover:text-white transition-colors"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Action row */}
              <div className="flex gap-2 px-4 pb-4">
                <button
                  onClick={() => setInviteTeam(team)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold"
                  style={{ background: 'rgba(234,82,111,0.12)', border: '1px solid rgba(234,82,111,0.25)', color: '#EA526F' }}
                >
                  <Plus size={11} />
                  Invite manager
                </button>

                {activeInvites.length > 0 && (
                  <button
                    onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold"
                    style={{ background: 'rgba(35,181,211,0.08)', border: '1px solid rgba(35,181,211,0.20)', color: '#23B5D3' }}
                  >
                    <Mail size={11} />
                    {activeInvites.length} active code{activeInvites.length !== 1 ? 's' : ''}
                  </button>
                )}

                <button
                  onClick={() => setDeleteTeam(team)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors"
                  style={{ background: 'rgba(234,82,111,0.08)', border: '1px solid rgba(234,82,111,0.20)', color: '#F07A90' }}
                  title="Delete team"
                >
                  <Trash2 size={11} />
                  Delete
                </button>
              </div>

              {/* Expanded invite codes */}
              {isExpanded && invites.length > 0 && (
                <div className="border-t mx-4 mb-4 pt-3" style={{ borderColor: 'rgba(247,247,255,0.06)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A8A9A] mb-2">
                    Invite codes
                  </p>
                  <div className="space-y-2">
                    {invites.map(invite => (
                      <InviteCodeRow
                        key={invite.id}
                        invite={invite}
                        onRevoke={() => revokeInvite.mutate(invite.id)}
                        onResend={() => resendInvite.mutate(invite.id)}
                        revoking={revokeInvite.isPending && revokeInvite.variables === invite.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && invites.length === 0 && (
                <div className="px-4 pb-4 text-[12px] text-[#8A8A9A]">No invite codes yet.</div>
              )}
            </div>
          )
        })}
      </div>

      {showNewTeam && (
        <NewTeamModal
          onClose={() => setShowNewTeam(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'teams'] })
            setShowNewTeam(false)
          }}
        />
      )}

      {inviteTeam && (
        <InviteManagerModal
          team={inviteTeam}
          onClose={() => setInviteTeam(null)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'invites'] })
            setInviteTeam(null)
          }}
        />
      )}

      {deleteTeam && (
        <ModalBackdrop onClose={() => !deleteTeamMutation.isPending && setDeleteTeam(null)}>
          <div className="flex items-center justify-center w-10 h-10 rounded-full mx-auto mb-3"
            style={{ background: 'rgba(234,82,111,0.12)' }}>
            <Trash2 size={18} className="text-[#EA526F]" />
          </div>
          <h3 className="text-[16px] font-bold text-white text-center mb-1">Delete team?</h3>
          <p className="text-[12px] text-[#8A8A9A] text-center mb-1">
            <span className="text-white font-semibold">{deleteTeam.name}</span> and all its data will be permanently deleted.
          </p>
          <p className="text-[11px] text-[#F07A90] text-center mb-5">
            {deleteTeam.memberCount} member{deleteTeam.memberCount !== 1 ? 's' : ''} · {deleteTeam.matchCount} game{deleteTeam.matchCount !== 1 ? 's' : ''} · {deleteTeam.playerCount} player{deleteTeam.playerCount !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteTeam(null)}
              disabled={deleteTeamMutation.isPending}
              className="flex-1 py-[12px] rounded-[12px] text-[13px] font-semibold text-[#8A8A9A] disabled:opacity-50"
              style={{ background: 'rgba(247,247,255,0.04)', border: '1px solid rgba(247,247,255,0.08)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => deleteTeamMutation.mutate(deleteTeam.id)}
              disabled={deleteTeamMutation.isPending}
              className="flex-1 py-[12px] rounded-[12px] text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #EA526F, #C0392B)' }}
            >
              {deleteTeamMutation.isPending ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({
  icon, value, label, color,
}: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold"
      style={{ background: `${color}18`, color }}>
      {icon}
      <span>{value}</span>
    </div>
  )
}

function InviteCodeRow({
  invite, onRevoke, onResend, revoking,
}: {
  invite: AdminInvite
  onRevoke: () => void
  onResend: () => void
  revoking: boolean
}) {
  const [copied, setCopied] = useState(false)
  const expired = invite.isExpired || invite.isFullyUsed

  const copyCode = () => {
    navigator.clipboard.writeText(invite.code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px]"
      style={{
        background: expired ? 'rgba(7,6,0,0.30)' : 'rgba(35,181,211,0.05)',
        border: `1px solid ${expired ? 'rgba(247,247,255,0.05)' : 'rgba(35,181,211,0.18)'}`,
        opacity: expired ? 0.55 : 1,
      }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <RoleBadge role={invite.role} />
          {invite.boundEmail && (
            <span className="text-[10px] text-[#8A8A9A] truncate max-w-[140px]">{invite.boundEmail}</span>
          )}
          {expired && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(234,82,111,0.15)', color: '#F07A90' }}>
              {invite.isFullyUsed ? 'Used' : 'Expired'}
            </span>
          )}
        </div>
        <p className="text-[10px] text-[#4A4A5A] mt-0.5">
          {invite.useCount}/{invite.maxUses} uses · expires {shortDate(invite.expiresAt)}
          {invite.createdBy && ` · by ${invite.createdBy}`}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!expired && invite.boundEmail && (
          <button onClick={onResend}
            className="p-1.5 rounded-md text-[#8A8A9A] hover:text-[#23B5D3] transition-colors"
            title="Resend email">
            <Mail size={13} />
          </button>
        )}
        {!expired && (
          <button onClick={copyCode}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: copied ? '#23B5D3' : '#8A8A9A' }}
            title="Copy invite ID">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
        <button onClick={onRevoke} disabled={revoking}
          className="p-1.5 rounded-md text-[#8A8A9A] hover:text-[#F07A90] transition-colors disabled:opacity-40"
          title="Revoke">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isManager = role === 'manager'
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
      style={{
        background: isManager ? 'rgba(234,82,111,0.15)' : 'rgba(39,154,241,0.15)',
        color: isManager ? '#EA526F' : '#279AF1',
      }}>
      {isManager ? 'Manager' : 'Player'}
    </span>
  )
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── New Team Modal ─────────────────────────────────────────────────────────────

function NewTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setLoading(true)
    try {
      await adminApi.createTeam(name.trim())
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <h3 className="text-[16px] font-bold text-white mb-1">New team</h3>
      <p className="text-[12px] text-[#8A8A9A] mb-4">A default season will be created automatically.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. VBC Berlin"
          autoFocus
          className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
          style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }}
        />
        {error && <p className="text-[12px] text-[#F07A90]">{error}</p>}
        <button type="submit" disabled={loading || !name.trim()}
          className="w-full py-[13px] rounded-[12px] text-[14px] font-bold text-black disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #23B5D3, #279AF1)' }}>
          {loading ? '…' : 'Create team'}
        </button>
      </form>
    </ModalBackdrop>
  )
}

// ── Invite Manager Modal ───────────────────────────────────────────────────────

function InviteManagerModal({
  team, onClose, onCreated,
}: { team: AdminTeam; onClose: () => void; onCreated: () => void }) {
  const [boundEmail, setBoundEmail] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [result, setResult]         = useState<{ code: string; emailSent: boolean } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await invitesApi.create({
        role: 'manager',
        teamId: team.id,
        boundEmail: boundEmail.trim() || undefined,
      })
      setResult({ code: res.code, emailSent: res.emailSent })
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <ModalBackdrop onClose={onClose}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'rgba(35,181,211,0.15)' }}>
            <Check size={22} className="text-[#23B5D3]" />
          </div>
          <h3 className="text-[16px] font-bold text-white mb-1">Code generated</h3>
          <p className="text-[12px] text-[#8A8A9A] mb-4">
            Share this code with the new manager for <span className="text-white font-semibold">{team.name}</span>.
          </p>

          <CodeDisplay code={result.code} />

          {result.emailSent && (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#23B5D3] mt-3">
              <Mail size={12} /> Invite email sent
            </p>
          )}
        </div>
      </ModalBackdrop>
    )
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <h3 className="text-[16px] font-bold text-white mb-0.5">Invite manager</h3>
      <p className="text-[12px] text-[#8A8A9A] mb-4">
        Generating a code for <span className="text-white font-semibold">{team.name}</span>
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8A8A9A] mb-1.5">
            Manager email (optional)
          </label>
          <input
            type="email"
            value={boundEmail}
            onChange={e => setBoundEmail(e.target.value)}
            placeholder="manager@club.de"
            className="w-full rounded-[10px] px-3 py-[11px] text-[14px] text-white outline-none"
            style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }}
          />
          <p className="text-[10px] text-[#4A4A5A] mt-1">
            If provided, the code is locked to this email and an invite email is sent.
          </p>
        </div>
        {error && <p className="text-[12px] text-[#F07A90]">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-[13px] rounded-[12px] text-[14px] font-bold text-black disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #EA526F, #23B5D3)' }}>
          {loading ? '…' : '🔑 Generate invite code'}
        </button>
      </form>
    </ModalBackdrop>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function CodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 rounded-[12px] p-3"
      style={{ background: 'rgba(35,181,211,0.08)', border: '1px solid rgba(35,181,211,0.25)' }}>
      <span className="flex-1 font-bold tracking-[0.20em] text-[18px] text-center"
        style={{ color: '#23B5D3' }}>
        {code.slice(0, 4)}·{code.slice(4)}
      </span>
      <button onClick={copy}
        className="p-2 rounded-lg transition-colors shrink-0"
        style={{ color: copied ? '#23B5D3' : '#8A8A9A' }}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  )
}

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-8"
      style={{ background: 'rgba(7,6,0,0.70)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm rounded-[20px] p-6 relative"
        style={{ background: 'rgba(22,20,18,0.98)', border: '1px solid rgba(247,247,255,0.10)' }}>
        <button onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#8A8A9A] hover:text-white transition-colors"
          style={{ background: 'rgba(247,247,255,0.06)' }}>
          <X size={15} />
        </button>
        {children}
      </div>
    </div>
  )
}

function AdminTeamsSkeleton() {
  return (
    <div className="px-5 md:px-8 pt-6 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-[16px] h-24"
          style={{ background: 'rgba(22,20,18,0.80)' }} />
      ))}
    </div>
  )
}
