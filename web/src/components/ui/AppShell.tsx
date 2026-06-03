import React, { useEffect } from 'react'
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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <main className={cn(
        'flex-1 overflow-y-auto',
        showNav && 'pb-[72px] md:pb-0 md:ml-[72px]',
      )}>
        {children}
      </main>

      {showNav && (
        <>
          {/* Mobile: bottom nav */}
          <nav className="fixed bottom-0 left-0 right-0 z-30 h-[72px] flex items-end pb-2 px-2 bg-pitch-800/95 backdrop-blur-sm border-t border-pitch-400/40 md:hidden">
            <div className="w-full flex justify-around items-center max-w-lg mx-auto">
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
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
                      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
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
              {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
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
                        {label}
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
