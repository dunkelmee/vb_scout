import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useRole } from '../hooks/useRole'
import { seasonsApi, teamApi, Season } from '../lib/api'
import { PageHeader } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { useToast } from '../components/ui/Toast'
import { ChevronDown, ChevronUp, ChevronRight, Plus, Edit3, Check } from 'lucide-react'
import { format } from '../lib/dateUtils'
import { cn } from '../components/ui/cn'

export function SettingsPage() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const { isManager } = useRole()
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
      <PageHeader title="Settings" subtitle="Account & Preferences" />

      <div className="px-5 space-y-5">
        {/* Account section */}
        <SettingsSection title="Account">
          <div className="space-y-1">
            <p className="text-xs text-on-surface-variant">Email</p>
            <p className="text-sm font-bold text-on-surface">{user?.email}</p>
          </div>
          <div className="pt-3 border-t border-outline/10">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant mb-2">Change password</p>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!newPassword || newPassword !== confirmPassword}
                onClick={() => showToast('Password updated', 'success')}
              >
                Update password
              </Button>
            </div>
          </div>
        </SettingsSection>

        {isManager && (
          <>
            {/* Team */}
            <SettingsSection title="Team">
              <TeamSettings />
            </SettingsSection>

            {/* TUS Settings */}
            <SettingsSection title="Timeout Urgency Score">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface">Window size</span>
                  <span className="text-sm font-bold text-on-surface">6 rallies</span>
                </div>
                <p className="text-xs text-on-surface-variant">Range: 4–10 rallies</p>
              </div>

              <button
                onClick={() => setShowTUSWeights(!showTUSWeights)}
                className="flex items-center justify-between w-full pt-3 border-t border-outline/10 mt-3"
              >
                <span className="text-sm font-bold text-on-surface">Advanced: Signal weights</span>
                {showTUSWeights ? <ChevronUp size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
              </button>

              {showTUSWeights && (
                <div className="mt-3 space-y-3 bg-surface-high rounded-xl p-3">
                  {[
                    { label: 'Momentum', default: '30%' },
                    { label: 'Error ratio', default: '25%' },
                    { label: 'Lead/deficit', default: '25%' },
                    { label: 'Positive play', default: '20%' },
                  ].map(({ label, default: def }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-on-surface">{label}</span>
                      <span className="text-xs font-bold text-orange">{def}</span>
                    </div>
                  ))}
                  <p className="text-xs text-on-surface-variant">Weights must sum to 100%</p>
                </div>
              )}
            </SettingsSection>

            {/* Seasons — hidden from main nav, accessible here */}
            <SettingsSection title="Seasons">
              <button
                onClick={() => setShowSeasons(!showSeasons)}
                className="flex items-center justify-between w-full"
              >
                <span className="text-sm text-on-surface">Manage seasons</span>
                {showSeasons ? <ChevronUp size={14} className="text-on-surface-variant" /> : <ChevronDown size={14} className="text-on-surface-variant" />}
              </button>

              {showSeasons && <SeasonsManager />}
            </SettingsSection>

            {/* Danger zone */}
            <SettingsSection title="Danger Zone" className="border-error/20">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm('Delete all match data? This cannot be undone.')) {
                    showToast('All match data deleted', 'error')
                  }
                }}
              >
                Delete all match data
              </Button>
            </SettingsSection>
          </>
        )}

        {/* Sign out */}
        <div className="pt-2">
          <Button variant="outline" fullWidth onClick={handleLogout}>
            Sign out
          </Button>
        </div>

        <p className="text-center text-xs text-on-surface-variant">courtside v1.0.0</p>
      </div>
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
      showToast('Team settings saved', 'success')
    },
    onError: () => showToast('Failed to save team settings', 'error'),
  })

  const preview = initials.trim() || deriveInitials(teamName)

  if (isLoading) {
    return <p className="text-xs text-on-surface-variant animate-pulse">Loading…</p>
  }

  return (
    <div className="space-y-3">
      <Input
        label="Team name"
        value={teamName}
        onChange={e => setTeamName(e.target.value)}
        placeholder="e.g. Volleyball Elite"
      />

      <div>
        <Input
          label="Scoring-button initials"
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
          <span className="text-xs text-on-surface-variant uppercase tracking-wide">Preview</span>
          <span className="font-display font-bold text-sm text-orange">{preview} ⊕</span>
        </div>
      )}

      <Button
        size="sm"
        onClick={() => updateMutation.mutate()}
        loading={updateMutation.isPending}
        disabled={!teamName.trim()}
      >
        Save team settings
      </Button>
    </div>
  )
}

// ── Seasons manager ───────────────────────────────────────────────────────

function SeasonsManager() {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
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

  const activateMutation = useMutation({
    mutationFn: (id: string) => seasonsApi.update(id, { isActive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasons'] })
      showToast('Season activated', 'success')
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
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-on-surface truncate">{s.name}</p>
              {s.isActive && <Badge label="Active" variant="green" size="sm" />}
            </div>
            <p className="text-xs text-on-surface-variant">{format(s.startDate)}</p>
          </div>
          <div className="flex items-center gap-1">
            {!s.isActive && (
              <button
                onClick={() => activateMutation.mutate(s.id)}
                className="p-1.5 rounded hover:bg-surface-high text-on-surface-variant"
                title="Set active"
              >
                <Check size={12} />
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id)
              }}
              className="p-1.5 rounded hover:bg-surface-high text-error/60"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-xs text-orange font-bold mt-1"
        >
          <Plus size={12} /> Add season
        </button>
      ) : (
        <div className="space-y-2 mt-2">
          <Input label="Season name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring 2025" required />
          <Input label="Start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          <Input label="End date (optional)" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!name} className="flex-1">
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
