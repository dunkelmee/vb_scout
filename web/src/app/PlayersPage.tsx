import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { playersApi, Player } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { PageHeader } from '../components/ui/AppShell'
import { Badge, PositionBadge } from '../components/ui/Badge'
import { PlayerAvatar } from '../components/players/PlayerAvatar'
import { Plus, Edit3, Trash2, ShieldCheck } from 'lucide-react'
import { cn } from '../components/ui/cn'

export function PlayersPage() {
  const { isManager } = useRole()
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: playersApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['players'] }),
  })

  // Determine which player the current user is
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

              {/* Actions */}
              {isManager && (
                <div className="flex items-center gap-1 shrink-0">
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

              {!isManager && isMe && (
                <Link
                  to={`/players/${player.id}`}
                  className="text-xs text-turq-500 font-bold border border-turq-500/30 rounded-full px-3 py-1.5 shrink-0"
                >
                  Profile
                </Link>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
