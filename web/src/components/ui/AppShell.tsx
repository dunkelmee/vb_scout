import React, { useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutGrid, CalendarDays, Dumbbell, Users, Settings, Shield, type LucideIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from './cn'
import { useRole } from '../../hooks/useRole'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'

interface AppShellProps {
  children: React.ReactNode
  hideNav?: boolean
}

const MANAGER_NAV = [
  { to: '/dashboard',  icon: LayoutGrid,  labelKey: 'nav.home' },
  { to: '/games',      icon: CalendarDays, labelKey: 'nav.games' },
  { to: '/trainings',  icon: Dumbbell,     labelKey: 'nav.trainings' },
  { to: '/players',    icon: Users,        labelKey: 'nav.players' },
  { to: '/settings',   icon: Settings,     labelKey: 'nav.settings' },
]

const PLAYER_NAV = [
  { to: '/dashboard',  icon: LayoutGrid,  labelKey: 'nav.home' },
  { to: '/games',      icon: CalendarDays, labelKey: 'nav.games' },
  { to: '/trainings',  icon: Dumbbell,     labelKey: 'nav.trainings' },
  { to: '/settings',   icon: Settings,     labelKey: 'nav.settings' },
]

const SUPERADMIN_NAV = [
  { to: '/dashboard',    icon: LayoutGrid, labelKey: 'nav.home' },
  { to: '/admin/teams',  icon: Shield,     labelKey: 'nav.teams' },
  { to: '/admin/users',  icon: Users,      labelKey: 'nav.users' },
  { to: '/settings',     icon: Settings,   labelKey: 'nav.settings' },
]

export function AppShell({ children, hideNav = false }: AppShellProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { isSuperAdmin, isManager } = useRole()
  const isLogScreen = location.pathname.includes('/log')
  const showNav = !hideNav && !isLogScreen

  const NAV_ITEMS: { to: string; icon: LucideIcon; labelKey: string }[] = isSuperAdmin ? SUPERADMIN_NAV : isManager ? MANAGER_NAV : PLAYER_NAV

  const mainRef = useRef<HTMLElement>(null)
  const qc = useQueryClient()
  const onRefresh = useCallback(() => qc.invalidateQueries(), [qc])
  const { pullY, refreshing, threshold } = usePullToRefresh(mainRef, onRefresh)

  const spinnerProgress = Math.min(pullY / threshold, 1)
  const showIndicator = pullY > 0 || refreshing

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Pull-to-refresh indicator */}
      {showIndicator && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ height: Math.max(pullY, refreshing ? 44 : 0), transition: refreshing ? 'height 0.2s' : 'none' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(22,20,18,0.90)',
              border: '1px solid rgba(247,247,255,0.12)',
              backdropFilter: 'blur(12px)',
              opacity: refreshing ? 1 : spinnerProgress,
              transform: `scale(${0.6 + spinnerProgress * 0.4})`,
            }}
          >
            <svg
              width="16" height="16" viewBox="0 0 16 16"
              style={{
                animation: refreshing ? 'ptr-spin 0.8s linear infinite' : 'none',
                transform: refreshing ? undefined : `rotate(${spinnerProgress * 270}deg)`,
              }}
            >
              <circle cx="8" cy="8" r="6" fill="none" stroke="#23B5D3" strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={refreshing ? '20 18' : `${spinnerProgress * 38} 38`}
              />
            </svg>
          </div>
        </div>
      )}

      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>

      <main
        ref={mainRef}
        className={cn(
          'flex-1 overflow-y-auto',
          showNav && 'pb-[72px] md:pb-0 md:ml-[72px]',
        )}
      >
        {children}
      </main>

      {showNav && (
        <>
          {/* Mobile: bottom nav */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 h-[72px] flex items-end pb-2 px-2 bg-pitch-800/95 backdrop-blur-sm border-t border-pitch-400/40 md:hidden">
            <div className="w-full flex justify-around items-center max-w-lg mx-auto">
              {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all min-w-[56px]',
                      isActive ? 'text-turq-500' : 'text-ghost-400 hover:text-ghost-300'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={22}
                        className={cn(isActive && 'drop-shadow-[0_0_6px_rgba(35,181,211,0.60)]')}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wide">{t(labelKey)}</span>
                      {isActive && (
                        <span className="absolute bottom-2 w-1 h-1 rounded-full bg-turq-500" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Tablet+: left sidebar nav */}
          <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-[72px] z-30 flex-col items-center bg-pitch-800/95 backdrop-blur-sm border-r border-pitch-400/40">
            <div className="py-5 border-b border-pitch-400/20 w-full flex justify-center">
              <img src="/vb-icon.svg" alt="courtside" className="w-8 h-8" />
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 py-4 w-full px-2">
              {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'relative flex flex-col items-center gap-1 py-2.5 w-full rounded-xl transition-all',
                      isActive
                        ? 'text-turq-500'
                        : 'text-ghost-400 hover:text-ghost-200 hover:bg-white/[0.04]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={20}
                        className={cn(isActive && 'drop-shadow-[0_0_6px_rgba(35,181,211,0.60)]')}
                      />
                      <span className="text-[9px] font-bold uppercase tracking-wide leading-tight text-center">
                        {t(labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      )}
    </div>
  )
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
  back?: string | boolean
  className?: string
}

export function PageHeader({ title, subtitle, right, className }: PageHeaderProps) {
  return (
    <div className={cn('px-5 md:px-8 pt-safe-top pt-4 pb-3', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {subtitle && (
            <p className="text-xs font-bold uppercase tracking-widest text-turq-500 mb-0.5">{subtitle}</p>
          )}
          <h1 className="font-display font-bold text-headline-lg-mobile md:text-headline-lg text-ghost-100">{title}</h1>
        </div>
        {right && <div className="shrink-0 mt-0.5">{right}</div>}
      </div>
    </div>
  )
}
