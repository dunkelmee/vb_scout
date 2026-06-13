import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check, ChevronRight, Plus } from 'lucide-react'
import { useTeamSeasonStore } from '../../store/teamSeasonStore'
import { authApi } from '../../lib/api'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  onClose: () => void
}

export function TeamSwitcherSheet({ onClose }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const allTeams       = useTeamSeasonStore(s => s.allTeams)
  const allSeasons     = useTeamSeasonStore(s => s.allSeasons)
  const activeTeamId   = useTeamSeasonStore(s => s.activeTeamId)
  const activeSeasonId = useTeamSeasonStore(s => s.activeSeasonId)
  const setActiveTeam   = useTeamSeasonStore(s => s.setActiveTeam)
  const setActiveSeason = useTeamSeasonStore(s => s.setActiveSeason)
  const loadTeams       = useTeamSeasonStore(s => s.loadTeams)

  const [switching, setSwitching] = useState<string | null>(null)

  // Join another team section
  const [joinCode, setJoinCode]   = useState('')
  const [joining, setJoining]     = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')
  const [showJoin, setShowJoin]   = useState(false)

  // Prevent body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSwitchTeam = async (teamId: string) => {
    if (teamId === activeTeamId || switching) return
    setSwitching(teamId)
    try {
      await setActiveTeam(teamId)
      qc.invalidateQueries()
    } finally {
      setSwitching(null)
      onClose()
    }
  }

  const handleSwitchSeason = (seasonId: string) => {
    setActiveSeason(seasonId)
    qc.invalidateQueries()
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCode.replace(/[\s·.]/g, '').toUpperCase()
    if (code.length < 8) return
    setJoinError('')
    setJoining(true)
    try {
      const res = await authApi.joinTeam(code)
      setJoinSuccess(t('teamSwitcher.joined', { team: res.team.name }))
      await loadTeams()
      qc.invalidateQueries()
      setTimeout(onClose, 1500)
    } catch (err: unknown) {
      setJoinError(err instanceof Error ? err.message : t('errors.invalidInviteCode'))
    } finally {
      setJoining(false)
    }
  }

  const roleLabel = (role: string) => role === 'manager' ? t('teamSwitcher.roleManager') : t('teamSwitcher.rolePlayer')

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(7,6,0,0.60)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div
        className="w-full rounded-t-[24px] overflow-hidden"
        style={{ background: 'rgba(16,14,12,0.98)', border: '1px solid rgba(247,247,255,0.08)', maxHeight: '85dvh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(247,247,255,0.15)' }} />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 28px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3">
            <h3 className="text-[15px] font-bold text-white">{t('teamSwitcher.title')}</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#8A8A9A] hover:text-white transition-colors"
              style={{ background: 'rgba(247,247,255,0.06)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Teams list */}
          <div className="px-5 space-y-2 pb-2">
            {allTeams.map(team => {
              const isActive  = team.teamId === activeTeamId
              const isSwitching = switching === team.teamId

              return (
                <button
                  key={team.teamId}
                  onClick={() => handleSwitchTeam(team.teamId)}
                  disabled={!!switching}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-[14px] text-left transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: isActive
                      ? 'rgba(35,181,211,0.10)'
                      : 'rgba(247,247,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(35,181,211,0.30)' : 'rgba(247,247,255,0.06)'}`,
                  }}
                >
                  {/* Initials */}
                  <div
                    className="w-9 h-9 rounded-[9px] flex items-center justify-center text-[11px] font-black text-white shrink-0"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #23B5D3 0%, #279AF1 100%)'
                        : 'rgba(247,247,255,0.08)',
                    }}
                  >
                    {team.teamInitials ?? team.teamName.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{team.teamName}</p>
                    <p className="text-[10px] text-[#8A8A9A]">
                      {roleLabel(team.role)}
                      {team.activeSeason && ` · ${team.activeSeason.name}`}
                    </p>
                  </div>

                  {isSwitching ? (
                    <span className="text-[11px] text-[#8A8A9A]">…</span>
                  ) : isActive ? (
                    <Check size={15} className="text-[#23B5D3] shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-[#4A4A5A] shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Season switcher — only shown when active team has multiple seasons */}
          {allSeasons.length > 1 && (
            <>
              <div className="mx-5 my-3 h-px" style={{ background: 'rgba(247,247,255,0.06)' }} />
              <div className="px-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A8A9A] mb-2">{t('teamSwitcher.season')}</p>
                <div className="space-y-1.5">
                  {allSeasons.map(season => {
                    const isActive = season.id === activeSeasonId
                    return (
                      <button
                        key={season.id}
                        onClick={() => handleSwitchSeason(season.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left transition-all"
                        style={{
                          background: isActive ? 'rgba(35,181,211,0.08)' : 'transparent',
                          border: `1px solid ${isActive ? 'rgba(35,181,211,0.20)' : 'transparent'}`,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-white truncate">{season.name}</p>
                          {season.isActive && (
                            <p className="text-[10px] text-[#23B5D3]">{t('teamSwitcher.currentSeason')}</p>
                          )}
                        </div>
                        {isActive && <Check size={13} className="text-[#23B5D3] shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Join another team */}
          <div className="mx-5 my-3 h-px" style={{ background: 'rgba(247,247,255,0.06)' }} />
          <div className="px-5 pb-8">
            {!showJoin ? (
              <button
                onClick={() => setShowJoin(true)}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] text-left"
                style={{ background: 'rgba(247,247,255,0.03)', border: '1px solid rgba(247,247,255,0.06)' }}
              >
                <div className="w-9 h-9 rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(234,82,111,0.10)', border: '1px solid rgba(234,82,111,0.20)' }}>
                  <Plus size={16} className="text-[#EA526F]" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-white">{t('teamSwitcher.joinAnother')}</p>
                  <p className="text-[10px] text-[#8A8A9A]">{t('teamSwitcher.enterCode')}</p>
                </div>
                <ChevronRight size={14} className="text-[#4A4A5A] shrink-0" />
              </button>
            ) : (
              <form onSubmit={handleJoin} className="space-y-2.5">
                <p className="text-[12px] font-semibold text-white">{t('teamSwitcher.joinAnother')}</p>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder={t('auth.register.inviteCodePlaceholder')}
                  maxLength={9}
                  autoFocus
                  className="w-full rounded-[10px] px-3 py-[11px] text-[15px] font-bold tracking-[0.15em] text-center uppercase outline-none"
                  style={{
                    background: 'rgba(7,6,0,0.60)',
                    border: '1px solid #2F2D28',
                    color: '#23B5D3',
                  }}
                />
                {joinError && <p className="text-[11px] text-[#F07A90]">{joinError}</p>}
                {joinSuccess && <p className="text-[11px] text-[#23B5D3]">{joinSuccess}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError('') }}
                    className="flex-1 py-[11px] rounded-[10px] text-[13px] font-semibold text-[#8A8A9A]"
                    style={{ background: 'rgba(247,247,255,0.04)', border: '1px solid rgba(247,247,255,0.06)' }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={joining || joinCode.replace(/[\s·.]/g, '').length < 8}
                    className="flex-1 py-[11px] rounded-[10px] text-[13px] font-bold text-black disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #EA526F, #23B5D3)' }}
                  >
                    {joining ? '…' : t('teamSwitcher.join')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
