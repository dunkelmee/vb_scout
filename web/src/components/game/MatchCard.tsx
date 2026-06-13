import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Match, BASE } from '../../lib/api'
import { format } from '../../lib/dateUtils'
import { cn } from '../ui/cn'
import { MapPin, Edit3, Trash2, BarChart2, Radio, Gavel } from 'lucide-react'

// ── Officiating avatars ────────────────────────────────────────────────────

type OfficialPlayer = { id: string; firstName: string; lastName: string; avatarUrl?: string | null }

function MiniAvatar({ player }: { player: OfficialPlayer }) {
  const initials = `${player.firstName[0]}${player.lastName[0]}`.toUpperCase()
  const title = `${player.firstName} ${player.lastName}`
  const palette = ['bg-turq-500/80', 'bg-bell-500/80', 'bg-bubb-400/80', 'bg-bell-400/80']
  const color = palette[(player.firstName.charCodeAt(0) + player.lastName.charCodeAt(0)) % palette.length]
  if (player.avatarUrl) {
    const src = player.avatarUrl.startsWith('http') ? player.avatarUrl : `${BASE}${player.avatarUrl}`
    return (
      <img src={src} alt={title} title={title}
        className="w-6 h-6 rounded-full object-cover ring-1 ring-pitch-700" />
    )
  }
  return (
    <div title={title}
      className={cn('w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] text-pitch-950 ring-1 ring-pitch-700', color)}>
      {initials}
    </div>
  )
}

function OfficialGroup({ label, p1, p2 }: { label: string; p1?: OfficialPlayer | null; p2?: OfficialPlayer | null }) {
  if (!p1 && !p2) return null
  const names = [p1, p2].filter(Boolean).map(p => p!.firstName).join(' · ')
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-ghost-400 font-bold uppercase tracking-wide">{label}</span>
      <div className="flex -space-x-1.5">
        {p1 && <MiniAvatar player={p1} />}
        {p2 && <MiniAvatar player={p2} />}
      </div>
      <span className="text-[10px] text-ghost-300 leading-tight">{names}</span>
    </div>
  )
}

export function OfficiatingAvatars({ match }: {
  match: Pick<Match, 'ref1' | 'ref2' | 'scorer1' | 'scorer2'>
}) {
  const { t } = useTranslation()
  const hasRefs = !!(match.ref1 || match.ref2)
  const hasScorers = !!(match.scorer1 || match.scorer2)
  if (!hasRefs && !hasScorers) return null
  return (
    <div className="grid grid-cols-2 gap-3 mt-2 mb-1">
      <OfficialGroup label={t('games.refs')} p1={match.ref1} p2={match.ref2} />
      <OfficialGroup label={t('games.scorers')} p1={match.scorer1} p2={match.scorer2} />
    </div>
  )
}

// ── Match card ─────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match
  isManager?: boolean
  canLog?: boolean
  onDelete?: () => void
  /** When provided, the card body is clickable (dashboard mode — no footer) */
  onCardClick?: () => void
}

export function MatchCard({
  match,
  isManager = false,
  canLog = false,
  onDelete,
  onCardClick,
}: MatchCardProps) {
  const { t } = useTranslation()
  const isPlaying  = match.matchType === 'playing'
  const isCompleted = match.status === 'completed'
  const isLive     = match.status === 'in_progress'
  const isUpcoming = match.status === 'upcoming'
  const won        = match.setsWonUs > match.setsWonThem
  const navigate   = useNavigate()
  const dashMode   = !!onCardClick

  const teamName   = match.team?.name ?? t('gameWizard.us')
  const currentSet = isLive ? (match.sets?.find(s => s.status === 'in_progress') ?? null) : null

  const borderClass = isLive
    ? 'border-turq-500/45'
    : isCompleted
      ? (won ? 'border-turq-500/25' : 'border-bubb-500/[0.22]')
      : isPlaying
        ? 'border-pitch-400/50'
        : 'border-bell-500/20'

  const stripeClass = isLive
    ? 'bg-gradient-to-r from-turq-500 via-turq-400 to-transparent animate-pulse-slow'
    : isCompleted
      ? (won
          ? 'bg-gradient-to-r from-turq-500 via-bell-500 to-transparent'
          : 'bg-gradient-to-r from-bubb-500 to-transparent')
      : isPlaying
        ? 'bg-gradient-to-r from-ghost-400/50 to-transparent'
        : 'bg-gradient-to-r from-bell-500 to-transparent'

  return (
    <div
      className={cn(
        'bg-pitch-700 border rounded-2xl overflow-hidden',
        borderClass,
        dashMode && 'cursor-pointer active:scale-[0.98] transition-transform',
      )}
      onClick={onCardClick}
    >
      {/* Stripe */}
      <div className={cn('h-0.5 w-full', stripeClass)} />

      {/* Body */}
      <div className="px-3.5 pt-3.5 pb-0">

        {/* Meta row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-ghost-300">
            {format(match.date)}
            {isLive && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-turq-500 uppercase tracking-[0.06em]">
                <span className="w-1.5 h-1.5 rounded-full bg-turq-500 animate-pulse inline-block" />
                {currentSet ? `${t('games.liveBadge')} · ${t('liveLog.set', { number: currentSet.setNumber })}` : t('games.liveBadge')}
              </span>
            )}
            {isCompleted && match.location && (
              <span className="text-ghost-300"> · {match.location}</span>
            )}
          </div>
          <div className="flex items-center">
            {isLive && match.location && (
              <span className="text-[10px] text-ghost-400 italic">{match.location}</span>
            )}
            {!isPlaying && (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.05em] px-2 py-0.5 rounded-full bg-bell-500/10 text-bell-500 border border-bell-500/25">
                <Gavel size={9} /> {t('games.officBadge')}
              </span>
            )}
          </div>
        </div>

        {/* Score row — playing live or completed */}
        {isPlaying && !isUpcoming && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex flex-col">
              <div className={cn(
                'text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]',
                isCompleted && !won && 'text-ghost-300',
              )}>
                {teamName}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">
                {isLive ? t('games.home') : t('gameWizard.us')}
              </div>
            </div>

            <div className="flex flex-col items-center flex-shrink-0 gap-0.5">
              <div className="flex items-baseline gap-1">
                <span className={cn(
                  'text-[38px] font-extrabold leading-none tracking-tighter tabular-nums',
                  isCompleted && won ? 'text-turq-500' : 'text-ghost-400/40',
                )}>
                  {isLive && currentSet ? currentSet.scoreUs : match.setsWonUs}
                </span>
                <span className="text-xl font-light text-ghost-400/40 mb-0.5">–</span>
                <span className={cn(
                  'text-[38px] font-extrabold leading-none tracking-tighter tabular-nums',
                  isCompleted && !won ? 'text-bubb-500' : 'text-ghost-400/40',
                )}>
                  {isLive && currentSet ? currentSet.scoreThem : match.setsWonThem}
                </span>
              </div>
              <div className="text-[10px] text-ghost-400 uppercase tracking-[0.06em] mt-0.5">
                {isLive && currentSet ? t('liveLog.set', { number: currentSet.setNumber }) : t('games.sets')}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-end text-right">
              <div className={cn(
                'text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]',
                isCompleted && won ? 'text-ghost-300' : isCompleted && !won ? 'text-bubb-400' : '',
              )}>
                {match.opponent || t('games.tbd')}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">
                {isLive ? t('games.away') : t('gameWizard.them')}
              </div>
            </div>
          </div>
        )}

        {/* Score row — playing upcoming */}
        {isPlaying && isUpcoming && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex flex-col">
              <div className="text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]">
                {teamName}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">{t('games.home')}</div>
            </div>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="text-lg font-semibold text-ghost-400 tracking-[0.05em]">vs</div>
            </div>
            <div className="flex-1 flex flex-col items-end text-right">
              <div className="text-[13px] font-bold leading-tight mb-0.5 truncate max-w-[120px]">
                {match.opponent || t('games.tbd')}
              </div>
              <div className="text-[9px] text-ghost-400 uppercase tracking-[0.06em]">{t('games.away')}</div>
            </div>
          </div>
        )}

        {/* Set pills — completed playing */}
        {isPlaying && isCompleted && match.sets && match.sets.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2.5 justify-center">
            {match.sets.map(set => (
              <span
                key={set.id}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums',
                  set.scoreUs > set.scoreThem
                    ? 'bg-turq-500/15 text-turq-500'
                    : 'bg-bubb-500/12 text-bubb-500',
                )}
              >
                {set.scoreUs}–{set.scoreThem}
              </span>
            ))}
          </div>
        )}

        {/* Officiating teams row */}
        {!isPlaying && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <div className="text-sm font-bold text-ghost-100">{match.homeTeam || '?'}</div>
            </div>
            <div className="text-[11px] font-bold text-ghost-400 uppercase px-2 py-1 bg-pitch-600 rounded">VS</div>
            <div className="flex-1 text-right">
              <div className="text-sm font-bold text-ghost-100">{match.guestTeam || '?'}</div>
            </div>
          </div>
        )}

        {/* Location — upcoming playing or officiating */}
        {(isUpcoming || !isPlaying) && match.location && (
          <div className="flex items-center gap-1.5 mb-2.5 text-xs text-ghost-300">
            <MapPin size={12} className="text-ghost-400" />
            {match.location}
          </div>
        )}

        {/* Officiating avatars (refs + scorers) */}
        <OfficiatingAvatars match={match} />

      </div>

      {/* Footer — GamesPage mode only */}
      {!dashMode && isManager && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 border-t border-pitch-500 mt-1">
          {canLog && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/games/${match.id}/log`) }}
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-turq-500"
            >
              <Radio size={12} /> {t('games.actionLog')}
            </button>
          )}
          {isPlaying && isCompleted && (
            <Link
              to={`/games/${match.id}/stats`}
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ghost-300"
            >
              <BarChart2 size={12} /> {t('games.actionStats')}
            </Link>
          )}
          <button
            onClick={e => { e.stopPropagation(); navigate(`/games/${match.id}/edit`) }}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ghost-300"
          >
            <Edit3 size={12} /> {t('games.actionEdit')}
          </button>
          <div className="flex-1" />
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="text-ghost-400 hover:text-bubb-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
      {!dashMode && !isManager && isCompleted && isPlaying && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 border-t border-pitch-500 mt-1">
          <Link
            to={`/games/${match.id}/stats`}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-turq-500"
          >
            <BarChart2 size={12} /> {t('games.actionStats')}
          </Link>
        </div>
      )}
    </div>
  )
}
