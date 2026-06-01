import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trainingsApi, TrainingSession, TrainingAttendance } from '../lib/api'
import { useRole } from '../hooks/useRole'
import { useAuthStore } from '../store/authStore'
import { PageHeader } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PositionBadge } from '../components/ui/Badge'
import { format, formatDuration } from '../lib/dateUtils'
import { ArrowLeft, MapPin, Edit3, Check, X } from 'lucide-react'
import { cn } from '../components/ui/cn'

export function TrainingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isManager } = useRole()
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: session } = useQuery<TrainingSession & {
    myAttendance?: TrainingAttendance
    comingPlayers?: string[]
  }>({
    queryKey: ['training', id],
    queryFn: () => trainingsApi.get(id!),
    enabled: !!id,
  })

  const { data: attendance = [] } = useQuery<TrainingAttendance[]>({
    queryKey: ['training-attendance', id],
    queryFn: () => trainingsApi.getAttendance(id!),
    enabled: !!id && isManager,
  })

  const rsvpMutation = useMutation({
    mutationFn: ({ playerId, status, note }: { playerId: string; status: string; note?: string }) =>
      trainingsApi.updateAttendance(id!, playerId, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training', id] })
      qc.invalidateQueries({ queryKey: ['training-attendance', id] })
    },
  })

  const [note, setNote] = useState('')

  if (!session) return null

  const coming = attendance.filter(a => a.status === 'coming')
  const notComing = attendance.filter(a => a.status === 'not_coming')
  const pending = attendance.filter(a => a.status === 'pending')

  // For player: find own attendance from myAttendance
  const myAttendance = session.myAttendance
  const myPlayerId = user?.playerId

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-2 border-b border-outline/10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/[0.06]">
          <ArrowLeft size={18} className="text-on-surface" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base text-on-surface">{session.title}</h1>
          <p className="text-xs text-on-surface-variant">
            {format(session.date)} · {formatDuration(session.startTime, session.endTime)}
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => navigate(`/trainings/${id}/edit`)}
            className="p-2 rounded-full hover:bg-white/[0.06]"
          >
            <Edit3 size={16} className="text-on-surface-variant" />
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Details */}
        <div className="card p-4 space-y-2">
          {session.location && (
            <p className="text-sm text-on-surface flex items-center gap-2">
              <MapPin size={14} className="text-on-surface-variant" />
              {session.location}
            </p>
          )}
          {session.focusTags && session.focusTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {session.focusTags.map(tag => (
                <Badge key={tag} label={tag} variant="orange" size="sm" />
              ))}
            </div>
          )}
          {session.notes && (
            <p className="text-sm text-on-surface-variant mt-2">{session.notes}</p>
          )}
        </div>

        {/* Player RSVP */}
        {!isManager && myPlayerId && (
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-3">Your RSVP</p>
            <div className="flex gap-3">
              <button
                onClick={() => rsvpMutation.mutate({ playerId: myPlayerId, status: 'coming', note })}
                className={cn(
                  'flex-1 py-4 rounded-xl border-2 font-display font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2',
                  myAttendance?.status === 'coming'
                    ? 'border-turq-500 bg-turq-500/10 text-turq-400'
                    : 'border-outline/20 text-on-surface-variant hover:border-turq-500/40'
                )}
              >
                <Check size={16} /> Coming
              </button>
              <button
                onClick={() => rsvpMutation.mutate({ playerId: myPlayerId, status: 'not_coming', note })}
                className={cn(
                  'flex-1 py-4 rounded-xl border-2 font-display font-bold text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2',
                  myAttendance?.status === 'not_coming'
                    ? 'border-error bg-error-container/20 text-error'
                    : 'border-outline/20 text-on-surface-variant hover:border-error/40'
                )}
              >
                <X size={16} /> Can't make it
              </button>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note (e.g. 'I'll arrive 15 min late')"
              className="mt-3 w-full bg-surface-high border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-orange/40 resize-none"
              rows={2}
            />
            {note && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => rsvpMutation.mutate({ playerId: myPlayerId, status: myAttendance?.status || 'pending', note })}
              >
                Save note
              </Button>
            )}

            {session.comingPlayers && session.comingPlayers.length > 0 && (
              <div className="mt-4 pt-3 border-t border-outline/10">
                <p className="text-xs text-on-surface-variant mb-2">
                  {session.comingPlayers.length} players confirmed:
                </p>
                <p className="text-sm text-on-surface">{session.comingPlayers.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        {/* Manager: full attendance roster */}
        {isManager && (
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-1">
              Attendance Roster
            </p>
            <p className="text-xs text-on-surface-variant mb-4">
              {coming.length} / {attendance.length} confirmed coming
            </p>

            {coming.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-turq-400 uppercase tracking-wide mb-2">Coming ({coming.length})</p>
                <AttendanceList attendance={coming} onRsvpChange={(playerId, status) => rsvpMutation.mutate({ playerId, status })} />
              </div>
            )}
            {notComing.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-error/70 uppercase tracking-wide mb-2">Not coming ({notComing.length})</p>
                <AttendanceList attendance={notComing} onRsvpChange={(playerId, status) => rsvpMutation.mutate({ playerId, status })} />
              </div>
            )}
            {pending.length > 0 && (
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-2">Pending ({pending.length})</p>
                <AttendanceList attendance={pending} onRsvpChange={(playerId, status) => rsvpMutation.mutate({ playerId, status })} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AttendanceList({
  attendance,
  onRsvpChange,
}: {
  attendance: TrainingAttendance[]
  onRsvpChange: (playerId: string, status: string) => void
}) {
  return (
    <div className="space-y-2">
      {attendance.map(a => (
        <div key={a.id} className="flex items-center gap-3 py-2 border-b border-outline/10">
          <span className="font-display font-bold text-xs text-orange w-7">
            #{a.player?.jersey || '–'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">
              {a.player?.firstName} {a.player?.lastName}
            </p>
            {a.note && <p className="text-xs text-on-surface-variant">{a.note}</p>}
          </div>
          <div className="flex gap-1">
            {a.player?.positions?.slice(0, 1).map(pos => (
              <PositionBadge key={pos} position={pos} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
