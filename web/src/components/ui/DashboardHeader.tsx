import React, { useState } from 'react'
import { Bell, ArrowRightLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useTeamSeasonStore } from '../../store/teamSeasonStore'
import { TeamSwitcherSheet } from './TeamSwitcherSheet'

export function DashboardHeader() {
  const user       = useAuthStore(s => s.user)
  const allTeams   = useTeamSeasonStore(s => s.allTeams)
  const allSeasons = useTeamSeasonStore(s => s.allSeasons)
  const activeTeamId   = useTeamSeasonStore(s => s.activeTeamId)
  const activeSeasonId = useTeamSeasonStore(s => s.activeSeasonId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const navigate = useNavigate()

  const activeTeam   = allTeams.find(t => t.teamId === activeTeamId)
  const activeSeason = allSeasons.find(s => s.id === activeSeasonId)

  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || '?'

  const firstName = user?.firstName || 'Coach'

  return (
    <>
      <div className="px-5 md:px-8 pt-safe-top pt-5 pb-3">
        {/* Top row: avatar + greeting + bell */}
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <button onClick={() => navigate('/settings')} className="relative shrink-0 active:scale-95 transition-transform">
            {user?.avatarUrl ? (
              <img src={`${import.meta.env.VITE_API_URL || ''}${user.avatarUrl}`}
                className="w-9 h-9 rounded-full object-cover" alt="Profile" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black text-white select-none"
                style={{ background: 'linear-gradient(135deg, #EA526F 0%, #23B5D3 60%, #279AF1 100%)' }}>
                {initials}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: '#23B5D3', borderColor: '#0B0A08' }} />
          </button>

          {/* Greeting */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A8A9A] leading-none mb-0.5">
              Welcome back
            </p>
            <p className="text-[16px] font-black text-white leading-none truncate">
              Hi, {firstName} 👋
            </p>
          </div>

          {/* Notification bell */}
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#8A8A9A] hover:text-white transition-colors shrink-0"
            style={{ background: 'rgba(247,247,255,0.06)', border: '1px solid rgba(247,247,255,0.08)' }}>
            <Bell size={16} />
          </button>
        </div>

        {/* Team + season bar */}
        <button
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[16px] active:scale-[0.98] transition-transform"
          style={{
            background: 'rgba(22,20,18,0.90)',
            border: '1px solid rgba(247,247,255,0.10)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.40)',
          }}
        >
          {/* Team initials */}
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-black text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #23B5D3 0%, #279AF1 100%)' }}>
            {activeTeam?.teamInitials ?? activeTeam?.teamName?.slice(0, 2).toUpperCase() ?? '—'}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <p className="text-[15px] font-bold text-white leading-tight truncate">
              {activeTeam?.teamName ?? 'No team'}
            </p>
            {activeSeason && (
              <p className="text-[11px] text-[#8A8A9A] leading-none truncate mt-0.5">
                {activeSeason.name}
              </p>
            )}
          </div>

          <ArrowRightLeft size={15} className="text-[#6A6A7A] shrink-0" />
        </button>
      </div>

      {sheetOpen && <TeamSwitcherSheet onClose={() => setSheetOpen(false)} />}
    </>
  )
}
