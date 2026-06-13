import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, AdminUser } from '../../lib/api'
import { PageHeader } from '../../components/ui/AppShell'
import { BottomSheet } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import type { BadgeVariant } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { Edit3, KeyRound } from 'lucide-react'

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  superadmin: 'loss',
  manager:    'info',
  player:     'neutral',
}

export function AdminUsersPage() {
  const { t } = useTranslation()
  const [editUser, setEditUser]   = useState<AdminUser | null>(null)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.users,
  })

  const roleLabel = (role: string) =>
    role === 'superadmin' ? t('admin.superadmin')
      : role === 'manager' ? t('teamSwitcher.roleManager')
        : t('teamSwitcher.rolePlayer')

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader title={t('admin.usersTitle')} subtitle={t('admin.superadmin')} />

      {isLoading && (
        <div className="px-5 md:px-8 space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="card h-16" />)}
        </div>
      )}

      {!isLoading && users.length === 0 && (
        <p className="px-5 md:px-8 py-16 text-center text-on-surface-variant">{t('admin.noUsers')}</p>
      )}

      <div className="px-5 md:px-8 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 pb-6">
        {users.map(u => {
          const name = `${u.firstName} ${u.lastName}`.trim() || u.email
          const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('').toUpperCase() || u.email[0]?.toUpperCase() || '?'
          const teams = u.teamMemberships.map(m => m.team.name).join(' · ')
          return (
            <div key={u.id} className="card px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #EA526F 0%, #23B5D3 60%, #279AF1 100%)' }}>
                {initials}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-display font-bold text-sm text-on-surface leading-tight truncate">{name}</p>
                  <Badge label={roleLabel(u.role)} variant={ROLE_VARIANT[u.role] ?? 'neutral'} size="sm" />
                </div>
                <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
                {teams && <p className="text-[11px] text-on-surface-variant/60 truncate mt-0.5">{teams}</p>}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditUser(u)}
                  title={t('admin.editUser')}
                  className="p-2 rounded-full hover:bg-white/[0.06] text-on-surface-variant"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => setResetUser(u)}
                  title={t('admin.resetPasswordTitle')}
                  className="p-2 rounded-full hover:bg-white/[0.06] text-secondary-container"
                >
                  <KeyRound size={16} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editUser && <EditUserSheet user={editUser} onClose={() => setEditUser(null)} />}
      {resetUser && <ResetPasswordSheet user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  )
}

function EditUserSheet({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { showToast } = useToast()

  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName,  setLastName]  = useState(user.lastName)
  const [email,     setEmail]     = useState(user.email)
  const [role,      setRole]      = useState<'superadmin' | 'manager' | 'player'>(user.role as 'superadmin' | 'manager' | 'player')

  const mutation = useMutation({
    mutationFn: () => adminApi.updateUser(user.id, {
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.trim(),
      role,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      showToast(t('admin.userUpdated'), 'success')
      onClose()
    },
    onError: (err: unknown) => showToast(err instanceof Error ? err.message : t('admin.userUpdateFailed'), 'error'),
  })

  return (
    <BottomSheet open onClose={onClose} title={t('admin.editUser')}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input label={t('players.firstName')} value={firstName} onChange={e => setFirstName(e.target.value)} />
          <Input label={t('players.lastName')}  value={lastName}  onChange={e => setLastName(e.target.value)} />
        </div>
        <Input label={t('settings.email')} type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Select
          label={t('admin.role')}
          value={role}
          onChange={e => setRole(e.target.value as 'superadmin' | 'manager' | 'player')}
          options={[
            { value: 'player',     label: t('teamSwitcher.rolePlayer') },
            { value: 'manager',    label: t('teamSwitcher.roleManager') },
            { value: 'superadmin', label: t('admin.superadmin') },
          ]}
        />
        <Button fullWidth onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!email.trim()}>
          {t('common.save')}
        </Button>
      </div>
    </BottomSheet>
  )
}

function ResetPasswordSheet({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => adminApi.resetPassword(user.id, password),
    onSuccess: () => {
      showToast(t('admin.passwordResetDone'), 'success')
      onClose()
    },
    onError: (err: unknown) => showToast(err instanceof Error ? err.message : t('admin.passwordResetFailed'), 'error'),
  })

  const name = `${user.firstName} ${user.lastName}`.trim() || user.email

  return (
    <BottomSheet open onClose={onClose} title={`${t('admin.resetPasswordTitle')} — ${name}`}>
      <div className="space-y-3">
        <Input
          label={t('admin.newPassword')}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={t('auth.register.passwordHint')}
        />
        <Button fullWidth onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={password.length < 8}>
          {t('admin.resetPasswordTitle')}
        </Button>
      </div>
    </BottomSheet>
  )
}
