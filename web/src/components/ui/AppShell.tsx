import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutGrid, CalendarDays, Dumbbell, Users, Settings } from 'lucide-react'
import { cn } from './cn'

interface AppShellProps {
  children: React.ReactNode
  hideNav?: boolean
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutGrid, label: 'Home' },
  { to: '/games', icon: CalendarDays, label: 'Games' },
  { to: '/trainings', icon: Dumbbell, label: 'Trainings' },
  { to: '/players', icon: Users, label: 'Players' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function AppShell({ children, hideNav = false }: AppShellProps) {
  const location = useLocation()
  const isLogScreen = location.pathname.includes('/log')

  const showNav = !hideNav && !isLogScreen

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Main content */}
      <main className={cn('flex-1 overflow-y-auto', showNav && 'pb-[72px]')}>
        {children}
      </main>

      {/* Bottom navigation */}
      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 h-[72px] flex items-end pb-2 px-2 bg-surface-container/95 backdrop-blur-sm border-t border-outline/10">
          <div className="w-full flex justify-around items-center max-w-lg mx-auto">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all min-w-[56px]',
                    isActive
                      ? 'text-orange'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={22}
                      className={cn(isActive && 'drop-shadow-[0_0_6px_rgba(255,92,0,0.6)]')}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                    {isActive && (
                      <span className="absolute bottom-2 w-1 h-1 rounded-full bg-orange" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

// Page header for inner pages
interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
  back?: string | boolean
  className?: string
}

export function PageHeader({ title, subtitle, right, className }: PageHeaderProps) {
  return (
    <div className={cn('px-5 pt-safe-top pt-4 pb-3', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {subtitle && (
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">{subtitle}</p>
          )}
          <h1 className="font-display font-bold text-headline-lg-mobile text-on-surface">{title}</h1>
        </div>
        {right && <div className="shrink-0 mt-0.5">{right}</div>}
      </div>
    </div>
  )
}
