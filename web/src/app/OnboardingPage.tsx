import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { playersApi, seasonsApi, teamApi } from '../lib/api'
import { useQueryClient } from '@tanstack/react-query'

export function OnboardingPage() {
  const { t }     = useTranslation()
  const user      = useAuthStore(s => s.user)
  const patchMe   = useAuthStore(s => s.patchMe)
  const navigate  = useNavigate()
  const qc        = useQueryClient()

  const role    = user?.role ?? 'player'
  const isManager = role === 'manager'
  const steps   = isManager ? 4 : 3

  const [step, setStep] = useState(1)

  // Manager state
  const [players, setPlayers] = useState<Array<{ firstName: string; lastName: string; jersey: string; position: string }>>([])
  const [playerDraft, setPlayerDraft] = useState({ firstName: '', lastName: '', jersey: '', position: '' })
  const [seasonName, setSeasonName]   = useState(`Season ${new Date().getFullYear()}`)

  // Player state
  const [birthday, setBirthday]   = useState('')
  const [heightM, setHeightM]     = useState('')
  const [positions, setPositions] = useState<string[]>([])
  const [jersey, setJersey]       = useState('')

  const [saving, setSaving] = useState(false)

  const POSITIONS = ['Setter', 'Outside', 'Opposite', 'Middle', 'Libero', 'DS']

  async function finishOnboarding() {
    setSaving(true)
    try {
      await patchMe({ onboardingDone: true })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/dashboard', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  async function handleManagerStep2() {
    // Auto-commit any in-progress draft
    const finalPlayers = playerDraft.firstName.trim()
      ? [...players, playerDraft]
      : players

    for (const p of finalPlayers) {
      await playersApi.create({
        firstName: p.firstName,
        lastName: p.lastName,
        jersey: p.jersey ? parseInt(p.jersey) : undefined,
        positions: p.position ? [p.position] : [],
      }).catch((err) => console.warn('[Onboarding] player create failed:', err))
    }
    qc.invalidateQueries({ queryKey: ['players'] })
    setStep(3)
  }

  async function handleManagerStep3() {
    if (seasonName.trim() && user?.teamId) {
      await seasonsApi.create({
        teamId: user.teamId,
        name: seasonName.trim(),
        startDate: new Date().toISOString().slice(0, 10),
        isActive: true,
      }).catch(() => {})
    }
    setStep(4)
  }

  const addPlayer = () => {
    if (!playerDraft.firstName.trim()) return
    setPlayers(ps => [...ps, playerDraft])
    setPlayerDraft({ firstName: '', lastName: '', jersey: '', position: '' })
  }

  const title = user?.firstName ? t('onboarding.greeting', { firstName: user.firstName }) : t('onboarding.welcome')

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#070600' }}>
      {/* Header */}
      <div className="px-5 pt-safe-top pt-6 pb-4" style={{
        background: 'radial-gradient(ellipse at 80% 0%, rgba(35,181,211,0.12) 0%, transparent 70%), #070600',
      }}>
        <p className="text-[12px] font-bold tracking-[0.18em] uppercase text-white/40 mb-1">courtside</p>
        <h1 className="text-[24px] font-black text-white">{title}</h1>
        <p className="text-[13px] text-[#8A8A9A]">{t('onboarding.setupSubtitle')}</p>

        {/* Step progress */}
        <div className="flex items-center gap-2 mt-5">
          {Array.from({ length: steps }, (_, i) => {
            const s = i + 1
            const done    = s < step
            const current = s === step
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5">
                  <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{
                      background: done
                        ? '#23B5D3'
                        : current
                          ? 'linear-gradient(135deg, #23B5D3, #279AF1)'
                          : 'rgba(255,255,255,0.06)',
                      color: done || current ? '#000' : '#4A4A5A',
                      boxShadow: current ? '0 0 12px rgba(35,181,211,0.40)' : 'none',
                    }}>
                    {done ? '✓' : s}
                  </div>
                  <span className="text-[10px] font-semibold hidden sm:block"
                    style={{ color: current ? '#23B5D3' : done ? '#8A8A9A' : '#4A4A5A' }}>
                    {isManager
                      ? [t('onboarding.chipTeam'), t('onboarding.chipPlayers'), t('onboarding.chipSeason'), t('onboarding.chipDone')][i]
                      : [t('onboarding.chipWelcome'), t('onboarding.chipProfile'), t('onboarding.chipDone')][i]}
                  </span>
                </div>
                {i < steps - 1 && (
                  <div className="flex-1 h-px" style={{ background: done ? '#23B5D3' : '#2F2D28' }} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-5 py-6">
        {isManager ? (
          <>
            {step === 1 && (
              <ManagerStep1
                teamId={user?.teamId ?? null}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <ManagerStep2
                players={players}
                draft={playerDraft}
                onDraftChange={setPlayerDraft}
                onAddPlayer={addPlayer}
                onNext={handleManagerStep2}
                onSkip={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <ManagerStep3
                seasonName={seasonName}
                onChange={setSeasonName}
                onNext={handleManagerStep3}
                onSkip={() => setStep(4)}
              />
            )}
            {step === 4 && (
              <DoneStep firstName={user?.firstName ?? ''} onFinish={finishOnboarding} saving={saving} />
            )}
          </>
        ) : (
          <>
            {step === 1 && (
              <PlayerStep1 onNext={() => setStep(2)} />
            )}
            {step === 2 && (
              <PlayerStep2
                birthday={birthday} onBirthday={setBirthday}
                heightM={heightM} onHeight={setHeightM}
                positions={positions} onPositions={setPositions}
                jersey={jersey} onJersey={setJersey}
                allPositions={POSITIONS}
                onNext={() => setStep(3)}
                onSkip={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <DoneStep firstName={user?.firstName ?? ''} onFinish={finishOnboarding} saving={saving} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Step components ───────────────────────────────────────────────────────────

function ManagerStep1({ teamId, onNext }: { teamId: string | null; onNext: () => void }) {
  const { t } = useTranslation()
  const [teamName, setTeamName] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!teamId) return
    teamApi.get()
      .then(d => setTeamName(d.name))
      .catch(() => {})
  }, [teamId])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-white mb-1">{t('onboarding.stepTeam')}</h2>
        <p className="text-[13px] text-[#8A8A9A]">{t('onboarding.teamReady')}</p>
      </div>

      {teamName && (
        <div className="rounded-[14px] p-4 flex items-center gap-3"
          style={{ background: '#161412', border: '1px solid rgba(35,181,211,0.20)' }}>
          <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center text-[16px] font-black text-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #23B5D3, #279AF1)' }}>
            {teamName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">{teamName}</p>
            <p className="text-[11px] text-[#8A8A9A]">{t('onboarding.headCoachManager')}</p>
          </div>
          <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'rgba(35,181,211,0.15)', color: '#23B5D3' }}>{t('teamSwitcher.roleManager')}</span>
        </div>
      )}

      <OnboardingButton onClick={onNext}>{t('onboarding.nextAddPlayers')}</OnboardingButton>
    </div>
  )
}

function ManagerStep2({
  players, draft, onDraftChange, onAddPlayer, onNext, onSkip,
}: {
  players: Array<{ firstName: string; lastName: string; jersey: string; position: string }>
  draft: { firstName: string; lastName: string; jersey: string; position: string }
  onDraftChange: (d: typeof draft) => void
  onAddPlayer: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-white mb-1">{t('onboarding.addPlayers')}</h2>
        <p className="text-[13px] text-[#8A8A9A]">{t('onboarding.addLater')}</p>
      </div>

      {players.length > 0 && (
        <div className="space-y-2">
          {players.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5"
              style={{ background: '#161412', border: '1px solid #2F2D28' }}>
              <span className="text-[12px] font-bold text-white flex-1">{p.firstName} {p.lastName}</span>
              {p.jersey && <span className="text-[11px] text-[#8A8A9A]">#{p.jersey}</span>}
              {p.position && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(35,181,211,0.12)', color: '#23B5D3' }}>{t(`positions.${p.position}`, { defaultValue: p.position })}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-[14px] p-3" style={{ background: '#161412', border: '1px solid #2F2D28' }}>
        <div className="grid grid-cols-2 gap-2">
          <OnboardingInput value={draft.firstName} onChange={v => onDraftChange({ ...draft, firstName: v })} placeholder={t('players.firstName')} />
          <OnboardingInput value={draft.lastName} onChange={v => onDraftChange({ ...draft, lastName: v })} placeholder={t('players.lastName')} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <OnboardingInput value={draft.jersey} onChange={v => onDraftChange({ ...draft, jersey: v })} placeholder={t('players.jersey')} type="number" />
          <select value={draft.position} onChange={e => onDraftChange({ ...draft, position: e.target.value })}
            className="rounded-[8px] px-2.5 py-2 text-[13px] text-white outline-none"
            style={{ background: 'rgba(7,6,0,0.6)', border: '1px solid #2F2D28' }}>
            <option value="">{t('onboarding.position')}</option>
            {['Setter','Outside','Opposite','Middle','Libero','DS'].map(p => <option key={p} value={p}>{t(`positions.${p}`, { defaultValue: p })}</option>)}
          </select>
        </div>
        <button type="button" onClick={onAddPlayer}
          className="w-full py-2 rounded-[8px] text-[12px] font-bold text-[#23B5D3]"
          style={{ background: 'rgba(35,181,211,0.08)', border: '1px solid rgba(35,181,211,0.20)' }}>
          {t('onboarding.addPlayerBtn')}
        </button>
      </div>

      <OnboardingButton onClick={onNext}>{t('onboarding.continue')}</OnboardingButton>
      <SkipButton onClick={onSkip} />
    </div>
  )
}

function ManagerStep3({ seasonName, onChange, onNext, onSkip }: {
  seasonName: string; onChange: (v: string) => void; onNext: () => void; onSkip: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-bold text-white mb-1">{t('onboarding.stepSeason')}</h2>
        <p className="text-[13px] text-[#8A8A9A]">{t('onboarding.seasonSub')}</p>
      </div>
      <OnboardingInput value={seasonName} onChange={onChange} placeholder={t('seasons.namePlaceholder')} />
      <OnboardingButton onClick={onNext}>{t('onboarding.createSeason')}</OnboardingButton>
      <SkipButton onClick={onSkip} />
    </div>
  )
}

function PlayerStep1({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-white mb-1">{t('onboarding.welcomeTeam')}</h2>
        <p className="text-[13px] text-[#8A8A9A]">{t('onboarding.coachAdded')}</p>
      </div>
      <OnboardingButton onClick={onNext}>{t('onboarding.setupProfile')}</OnboardingButton>
    </div>
  )
}

function PlayerStep2({ birthday, onBirthday, heightM, onHeight, positions, onPositions, jersey, onJersey, allPositions, onNext, onSkip }: {
  birthday: string; onBirthday: (v: string) => void
  heightM: string; onHeight: (v: string) => void
  positions: string[]; onPositions: (v: string[]) => void
  jersey: string; onJersey: (v: string) => void
  allPositions: string[]; onNext: () => void; onSkip: () => void
}) {
  const { t } = useTranslation()
  const toggle = (pos: string) => {
    onPositions(positions.includes(pos) ? positions.filter(p => p !== pos) : [...positions, pos])
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[20px] font-bold text-white mb-1">{t('onboarding.yourProfile')}</h2>
        <p className="text-[13px] text-[#8A8A9A]">{t('onboarding.allOptional')}</p>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8A8A9A] mb-1.5">{t('players.positions')}</label>
        <div className="flex flex-wrap gap-2">
          {allPositions.map(pos => (
            <button key={pos} type="button" onClick={() => toggle(pos)}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold"
              style={{
                background: positions.includes(pos) ? 'rgba(35,181,211,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${positions.includes(pos) ? 'rgba(35,181,211,0.40)' : '#2F2D28'}`,
                color: positions.includes(pos) ? '#23B5D3' : '#8A8A9A',
              }}>
              {t(`positions.${pos}`, { defaultValue: pos })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8A8A9A] mb-1.5">{t('players.jersey')}</label>
          <OnboardingInput value={jersey} onChange={onJersey} placeholder={t('players.jerseyEg')} type="number" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8A8A9A] mb-1.5">{t('players.height')}</label>
          <OnboardingInput value={heightM} onChange={onHeight} placeholder={t('players.heightEg')} type="number" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#8A8A9A] mb-1.5">{t('players.birthday')}</label>
        <OnboardingInput value={birthday} onChange={onBirthday} placeholder="" type="date" />
      </div>

      <OnboardingButton onClick={onNext}>{t('onboarding.saveProfile')}</OnboardingButton>
      <SkipButton onClick={onSkip} />
    </div>
  )
}

function DoneStep({ firstName, onFinish, saving }: { firstName: string; onFinish: () => void; saving: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="text-center space-y-6 pt-8">
      <div className="text-[64px]">🏐</div>
      <div>
        <h2 className="text-[24px] font-black text-white mb-2">{firstName ? t('onboarding.allSet', { firstName }) : t('onboarding.allSetNoName')}</h2>
        <p className="text-[14px] text-[#8A8A9A]">{t('onboarding.doneSub')}</p>
      </div>
      <OnboardingButton onClick={onFinish} disabled={saving}>
        {saving ? t('onboarding.settingUp') : `${t('onboarding.goToDashboard')} →`}
      </OnboardingButton>
    </div>
  )
}

// ── Primitives ────────────────────────────────────────────────────────────────

function OnboardingButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-full py-[14px] rounded-[12px] text-[14px] font-bold text-black disabled:opacity-50"
      style={{ background: 'linear-gradient(135deg, #23B5D3, #279AF1)', boxShadow: '0 4px 22px rgba(35,181,211,0.28)' }}>
      {children}
    </button>
  )
}

function SkipButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick} className="w-full py-2 text-[12px] text-[#4A4A5A]">
      {t('onboarding.skipForNow')}
    </button>
  )
}

function OnboardingInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-[10px] px-3 py-[10px] text-[14px] text-white outline-none"
      style={{ background: 'rgba(7,6,0,0.60)', border: '1px solid #2F2D28' }} />
  )
}
