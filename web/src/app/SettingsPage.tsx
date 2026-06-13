import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LanguageSelector } from '../components/settings/LanguageSelector'
import { useRole } from '../hooks/useRole'
import { seasonsApi, teamApi, authApi, playersApi, pushApi, Season } from '../lib/api'
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed, shouldShowPushPrompt } from '../lib/pushSubscription'
import { PageHeader } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/ui/Modal' // eslint-disable-line @typescript-eslint/no-unused-vars
import { Badge } from '../components/ui/Badge'
import { useToast } from '../components/ui/Toast'
import { ChevronDown, ChevronUp, Plus, Edit3, Check, Camera, Trash2 } from 'lucide-react'
import { ChipGroup } from '../components/ui/Select'

const POSITION_OPTIONS = ['Setter', 'Outside', 'Opposite', 'Middle', 'Libero', 'DS']
import { format } from '../lib/dateUtils'
import { cn } from '../components/ui/cn'

export function SettingsPage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const { isManager, isSuperAdmin } = useRole()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showSeasons, setShowSeasons] = useState(false)
  const [showTUSWeights, setShowTUSWeights] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleLogout = async () => {
    await logout()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-background pb-8">
      <PageHeader title={t('settings.title')} subtitle={t('settings.account')} />

      <div className="px-5 space-y-5">
        {/* Profile section */}
        <SettingsSection title={t('settings.profile')}>
          <ProfileSection />
        </SettingsSection>

        {/* Language section */}
        <SettingsSection title={t('settings.language')}>
          <LanguageSelector />
        </SettingsSection>

        {/* Account section */}
        <SettingsSection title={t('settings.account')}>
          <div className="space-y-1">
            <p className="text-xs text-on-surface-variant">{t('settings.email')}</p>
            <p className="text-sm font-bold text-on-surface">{user?.email}</p>
          </div>
          <div className="pt-3 border-t border-outline/10">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">{t('settings.changePassword')}</p>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={t('auth.register.password')}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder={t('auth.register.password')}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!newPassword || newPassword !== confirmPassword}
                onClick={() => showToast(t('settings.passwordUpdated'), 'success')}
              >
                {t('settings.updatePassword')}
              </Button>
            </div>
          </div>
        </SettingsSection>

        {isManager && !isSuperAdmin && (
          <>
            {/* Team */}
            <SettingsSection title={t('settings.team')}>
              <TeamSettings />
            </SettingsSection>

            {/* TUS Settings */}
            <SettingsSection title={t('settings.timeoutUrgencyScore')}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface">{t('settings.windowSize')}</span>
                  <span className="text-sm font-bold text-on-surface">{t('postMatch.rallies', { count: 6 })}</span>
                </div>
                <p className="text-xs text-on-surface-variant">{t('settings.windowRange')}</p>
              </div>

              <button
                onClick={() => setShowTUSWeights(!showTUSWeights)}
                className="flex items-center justify-between w-full pt-3 border-t border-outline/10 mt-3"
              >
                <span className="text-sm font-bold text-on-surface">{t('settings.signalWeights')}</span>
                {showTUSWeights ? <ChevronUp size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
              </button>

              {showTUSWeights && (
                <div className="mt-3 space-y-3 bg-surface-high rounded-xl p-3">
                  {[
                    { label: t('stats.momentum'), default: '30%' },
                    { label: t('stats.errorRatio'), default: '25%' },
                    { label: t('stats.leadDeficit'), default: '25%' },
                    { label: t('stats.positivePlay'), default: '20%' },
                  ].map(({ label, default: def }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-on-surface">{label}</span>
                      <span className="text-xs font-bold text-orange">{def}</span>
                    </div>
                  ))}
                  <p className="text-xs text-on-surface-variant">{t('settings.weightSum')}</p>
                </div>
              )}
            </SettingsSection>

            {/* Seasons — hidden from main nav, accessible here */}
            <SettingsSection title={t('seasons.title')}>
              <button
                onClick={() => setShowSeasons(!showSeasons)}
                className="flex items-center justify-between w-full"
              >
                <span className="text-sm text-on-surface">{t('settings.manageSeasons')}</span>
                {showSeasons ? <ChevronUp size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
              </button>

              {showSeasons && <SeasonsManager />}
            </SettingsSection>

            {/* Danger zone */}
            <SettingsSection title={t('settings.dangerZone')} className="border-error/20">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm(t('settings.deleteMatchData') + '?')) {
                    showToast(t('settings.matchDataDeleted'), 'error')
                  }
                }}
              >
                {t('settings.deleteMatchData')}
              </Button>
            </SettingsSection>
          </>
        )}

        {/* Notifications */}
        {!isSuperAdmin && (
          <SettingsSection title={t('settings.notifications')}>
            <NotificationSettings />
          </SettingsSection>
        )}

        {/* Sign out */}
        <div className="pt-2">
          <Button variant="outline" fullWidth onClick={handleLogout}>
            {t('settings.signOut')}
          </Button>
        </div>

        <p className="text-center text-xs text-on-surface-variant">
          {t('settings.version', { version: import.meta.env.VITE_APP_VERSION ?? 'dev' })}
        </p>
      </div>
    </div>
  )
}

function ProfileSection() {
  const { t } = useTranslation()
  const user    = useAuthStore(s => s.user)
  const { isPlayer } = useRole()
  const setUser = useAuthStore(s => s.setUser)
  const token   = useAuthStore(s => s.token)
  const patchMe = useAuthStore(s => s.patchMe)
  const qc      = useQueryClient()
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const playerInitialized = useRef(false)

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName,  setLastName]  = useState(user?.lastName  ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)

  // Player-specific fields
  const [jersey,            setJersey]    = useState('')
  const [birthday,          setBirthday]  = useState('')
  const [heightM,           setHeightM]   = useState('')
  const [positions,         setPositions] = useState<string[]>([])
  const [isLibero,          setIsLibero]  = useState(false)
  const [hasRefereeLicense, setHasRef]    = useState(false)

  const { data: player } = useQuery({
    queryKey: ['player', user?.playerId],
    queryFn: () => playersApi.get(user!.playerId!),
    enabled: isPlayer && !!user?.playerId,
  })

  // Populate player fields once on load — don't re-run on background refetches
  useEffect(() => {
    if (player && !playerInitialized.current) {
      setFirstName(player.firstName)
      setLastName(player.lastName)
      setJersey(player.jersey?.toString() || '')
      setBirthday(player.birthday ? player.birthday.slice(0, 10) : '')
      setHeightM(player.heightM?.toString() || '')
      setPositions(player.positions)
      setIsLibero(player.isLibero)
      setHasRef(player.hasRefereeLicense)
      playerInitialized.current = true
    }
  }, [player])

  const avatarUrl = user?.avatarUrl
    ? `${import.meta.env.VITE_API_URL || ''}${user.avatarUrl}`
    : null

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { avatarUrl: newUrl } = await authApi.uploadAvatar(file)
      if (user && token) setUser({ ...user, avatarUrl: newUrl }, token)
      if (isPlayer && user?.playerId) {
        await playersApi.uploadPhoto(user.playerId, file)
        qc.invalidateQueries({ queryKey: ['players'] })
        qc.invalidateQueries({ queryKey: ['player', user.playerId] })
      }
      showToast(t('settings.photoUpdated'), 'success')
    } catch {
      showToast(t('players.photoUploadFailed'), 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    setUploading(true)
    try {
      await authApi.deleteAvatar()
      if (user && token) setUser({ ...user, avatarUrl: null }, token)
      if (isPlayer && user?.playerId) {
        await playersApi.deletePhoto(user.playerId)
        qc.invalidateQueries({ queryKey: ['players'] })
        qc.invalidateQueries({ queryKey: ['player', user.playerId] })
      }
      showToast(t('settings.photoRemoved'), 'success')
    } catch {
      showToast(t('players.photoRemoveFailed'), 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await patchMe({ firstName: firstName.trim(), lastName: lastName.trim() })
      if (isPlayer && user?.playerId) {
        await playersApi.update(user.playerId, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          jersey: jersey ? parseInt(jersey) : undefined,
          birthday: birthday || undefined,
          heightM: heightM ? parseFloat(heightM) : undefined,
          positions,
          isLibero,
          hasRefereeLicense,
        })
        qc.invalidateQueries({ queryKey: ['players'] })
        qc.invalidateQueries({ queryKey: ['player', user.playerId] })
      }
      showToast(t('settings.profileSaved'), 'success')
    } catch {
      showToast(t('settings.profileSaveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePositions = (pos: string[]) => {
    setPositions(pos)
    setIsLibero(pos.includes('Libero'))
  }

  const nameChanged = firstName.trim() !== (user?.firstName ?? '') || lastName.trim() !== (user?.lastName ?? '')
  const playerChanged = isPlayer && !!player && (
    jersey !== (player.jersey?.toString() || '') ||
    birthday !== (player.birthday ? player.birthday.slice(0, 10) : '') ||
    heightM !== (player.heightM?.toString() || '') ||
    JSON.stringify(positions) !== JSON.stringify(player.positions) ||
    hasRefereeLicense !== player.hasRefereeLicense
  )
  const hasChanges = nameChanged || playerChanged

  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover" alt="Profile" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-[18px] font-black text-white"
              style={{ background: 'linear-gradient(135deg, #EA526F 0%, #23B5D3 60%, #279AF1 100%)' }}>
              {initials}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center disabled:opacity-50"
            style={{ background: '#23B5D3', border: '2px solid #0B0A08' }}
          >
            <Camera size={11} className="text-black" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-on-surface">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-on-surface-variant mb-2">{user?.email}</p>
          {avatarUrl && (
            <button
              onClick={handleRemovePhoto}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-error/70 disabled:opacity-40"
            >
              <Trash2 size={11} /> Remove photo
            </button>
          )}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

      {/* Name — shared between user account and player record */}
      <div className="grid grid-cols-2 gap-2">
        <Input label={t('players.firstName')} value={firstName} onChange={e => setFirstName(e.target.value)} />
        <Input label={t('players.lastName')}  value={lastName}  onChange={e => setLastName(e.target.value)} />
      </div>

      {/* Player-specific fields — only visible to player-role users */}
      {isPlayer && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Input label={t('players.jersey')}   type="number" value={jersey}   onChange={e => setJersey(e.target.value)}   placeholder="7" />
            <Input label={t('players.height')} type="number" value={heightM}  onChange={e => setHeightM(e.target.value)}  step="0.01" placeholder="1.85" />
            <Input label={t('players.birthday')}   type="date"   value={birthday} onChange={e => setBirthday(e.target.value)} />
          </div>

          <ChipGroup
            label={t('players.positions')}
            options={POSITION_OPTIONS}
            selected={positions}
            onChange={handlePositions}
            renderLabel={opt => t(`positions.${opt}`, { defaultValue: opt })}
          />

          <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={hasRefereeLicense}
              onChange={e => setHasRef(e.target.checked)}
              className="w-4 h-4 accent-orange"
            />
            {t('players.hasLicense')}
          </label>
        </>
      )}

      {hasChanges && (
        <Button size="sm" onClick={handleSave} loading={saving}>
          {t('common.save')}
        </Button>
      )}
    </div>
  )
}

function NotificationSettings() {
  const { t } = useTranslation()
  const user     = useAuthStore(s => s.user)
  const { isManager } = useRole()
  const { showToast } = useToast()
  const patchMe  = useAuthStore(s => s.patchMe)

  const [subscribed, setSubscribed]     = useState<boolean | null>(null)
  const [toggling, setToggling]         = useState(false)

  useEffect(() => {
    isPushSubscribed().then(setSubscribed)
  }, [])

  const handleTogglePush = async () => {
    setToggling(true)
    try {
      if (subscribed) {
        await unsubscribeFromPush()
        setSubscribed(false)
        showToast(t('settings.pushDisabled'), 'success')
      } else {
        const ok = await subscribeToPush()
        setSubscribed(ok)
        showToast(ok ? t('settings.pushEnabled') : t('settings.permissionDenied'), ok ? 'success' : 'error')
      }
    } catch {
      showToast(t('settings.notifChangeFailed'), 'error')
    } finally {
      setToggling(false)
    }
  }

  const handlePrefToggle = async (field: string, value: boolean) => {
    try {
      await patchMe({ [field]: value } as Parameters<typeof patchMe>[0])
    } catch {
      showToast(t('settings.prefUpdateFailed'), 'error')
    }
  }

  const prefs = [
    { key: 'notifTrainingReminder', label: t('settings.trainingReminders'), desc: t('settings.trainingRemindersSub') },
    { key: 'notifMatchReminder',    label: t('settings.matchReminders'),    desc: t('settings.matchRemindersSub') },
    ...(isManager ? [
      { key: 'notifRsvpResponses',  label: t('settings.playerResponses'),   desc: t('settings.playerResponsesSub') },
      { key: 'notifAnalysisReady',  label: t('settings.analysisReady'),     desc: t('settings.analysisReadySub') },
    ] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-on-surface">{t('settings.pushNotifications')}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {subscribed === null ? t('settings.checking') : subscribed ? t('settings.enabledThisDevice') : t('settings.disabledState')}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          loading={toggling}
          onClick={handleTogglePush}
          disabled={subscribed === null}
        >
          {subscribed ? t('settings.disable') : t('settings.enable')}
        </Button>
      </div>

      <div className="pt-3 border-t border-outline/10 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{t('settings.whatToNotify')}</p>
        {prefs.map(pref => {
          const value = (user as unknown as Record<string, unknown>)?.[pref.key] as boolean | undefined
          return (
            <label key={pref.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value ?? true}
                onChange={e => handlePrefToggle(pref.key, e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-orange shrink-0"
              />
              <div>
                <p className="text-sm text-on-surface">{pref.label}</p>
                <p className="text-xs text-on-surface-variant">{pref.desc}</p>
              </div>
            </label>
          )
        })}
      </div>

      {'Notification' in window && (
        <p className="text-xs text-on-surface-variant">
          {t('settings.iphoneHint')}
        </p>
      )}
    </div>
  )
}

function SettingsSection({
  title, children, className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('card p-4', className)}>
      <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">{title}</p>
      {children}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function deriveInitials(name: string): string {
  if (!name.trim()) return ''
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
}

// ── Team settings component ───────────────────────────────────────────────

function TeamSettings() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [teamName, setTeamName] = useState('')
  const [initials, setInitials] = useState('')

  const { data: team, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: teamApi.get,
  })

  // Populate form once data arrives
  useEffect(() => {
    if (team) {
      setTeamName(team.name)
      setInitials(team.initials ?? '')
    }
  }, [team?.name, team?.initials])

  const updateMutation = useMutation({
    mutationFn: () =>
      teamApi.update({ name: teamName.trim(), initials: initials.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] })
      showToast(t('settings.teamSaved'), 'success')
    },
    onError: () => showToast(t('settings.teamSaveFailed'), 'error'),
  })

  const preview = initials.trim() || deriveInitials(teamName)

  if (isLoading) {
    return <p className="text-xs text-on-surface-variant animate-pulse">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-3">
      <Input
        label={t('settings.teamName')}
        value={teamName}
        onChange={e => setTeamName(e.target.value)}
        placeholder={t('settings.teamNameEg')}
      />

      <div>
        <Input
          label={t('settings.scoringInitials')}
          value={initials}
          onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 5))}
          placeholder={deriveInitials(teamName) || 'e.g. VE'}
        />
        <p className="text-xs text-on-surface-variant mt-1">
          {initials.trim()
            ? `Shown as "${initials.trim()}" in scoring buttons`
            : teamName.trim()
              ? `Leave blank to auto-derive → "${deriveInitials(teamName)}"`
              : 'Leave blank to auto-derive from team name'}
        </p>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-surface-high">
          <span className="text-xs text-on-surface-variant uppercase tracking-wide">{t('settings.preview')}</span>
          <span className="font-display font-bold text-sm text-orange">{preview} ⊕</span>
        </div>
      )}

      <Button
        size="sm"
        onClick={() => updateMutation.mutate()}
        loading={updateMutation.isPending}
        disabled={!teamName.trim()}
      >
        {t('common.save')}
      </Button>
    </div>
  )
}

// ── Seasons manager ───────────────────────────────────────────────────────

function SeasonsManager() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')

  const { data: seasons = [] } = useQuery<Season[]>({
    queryKey: ['seasons'],
    queryFn: seasonsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => seasonsApi.create({ name, startDate, endDate: endDate || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
      setShowForm(false)
      setName('')
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      seasonsApi.update(id, { name: newName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditId(null)
      showToast(t('settings.seasonRenamed'), 'success')
    },
    onError: () => showToast(t('settings.seasonRenameFailed'), 'error'),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => seasonsApi.update(id, { isActive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
      showToast(t('settings.seasonActivated'), 'success')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => seasonsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
  })

  return (
    <div className="mt-3 space-y-2">
      {seasons.map(s => (
        <div key={s.id} className="flex items-center gap-2 py-2 border-b border-outline/10">
          <div className="flex-1 min-w-0">
            {editId === s.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder={t('seasons.nameLabel')}
                  autoFocus
                />
                <button
                  onClick={() => renameMutation.mutate({ id: s.id, newName: editName })}
                  disabled={!editName.trim() || renameMutation.isPending}
                  className="p-1.5 rounded text-orange disabled:opacity-40"
                  title={t('common.save')}
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="p-1.5 rounded text-on-surface-variant"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-on-surface truncate">{s.name}</p>
                {s.isActive && <Badge label={t('seasons.active')} variant="green" size="sm" />}
              </div>
            )}
            <p className="text-xs text-on-surface-variant mt-0.5">{format(s.startDate)}</p>
          </div>
          <div className="flex items-center gap-1">
            {editId !== s.id && (
              <button
                onClick={() => { setEditId(s.id); setEditName(s.name) }}
                className="p-1.5 rounded hover:bg-white/[0.06] text-on-surface-variant"
                title={t('common.rename')}
              >
                <Edit3 size={12} />
              </button>
            )}
            {!s.isActive && editId !== s.id && (
              <button
                onClick={() => activateMutation.mutate(s.id)}
                className="p-1.5 rounded hover:bg-white/[0.06] text-on-surface-variant"
                title={t('seasons.setActive')}
              >
                <Check size={12} />
              </button>
            )}
            {editId !== s.id && (
              <button
                onClick={() => {
                  if (confirm(`${t('common.delete')} "${s.name}"?`)) deleteMutation.mutate(s.id)
                }}
                className="p-1.5 rounded hover:bg-white/[0.06] text-error/60"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-xs text-orange font-bold mt-1"
        >
          <Plus size={12} /> {t('seasons.newSeason')}
        </button>
      ) : (
        <div className="space-y-2 mt-2">
          <Input label={t('seasons.nameLabel')} value={name} onChange={e => setName(e.target.value)} placeholder={t('seasons.namePlaceholder')} required />
          <Input label={t('seasons.startDate')} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          <Input label={t('seasons.endDateOptional')} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!name} className="flex-1">
              {t('common.create')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
