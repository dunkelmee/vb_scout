import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth, ManagerOnly } from './router/index'
import { AppShell } from './components/ui/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { useSeasonStore } from './store/seasonStore'
import { useAuthStore } from './store/authStore'

// Pages
import { LoginPage } from './app/auth/LoginPage'
import { RegisterPage } from './app/auth/RegisterPage'
import { AcceptInvitePage } from './app/auth/AcceptInvitePage'
import { DashboardPage } from './app/DashboardPage'
import { GamesPage } from './app/GamesPage'
import { GameLogPage } from './app/GameLogPage'
import { GameEditPage } from './app/GameEditPage'
import { GameStatsPage } from './app/GameStatsPage'
import { TrainingsPage } from './app/TrainingsPage'
import { TrainingDetailPage } from './app/TrainingDetailPage'
import { TrainingFormPage } from './app/TrainingFormPage'
import { PlayersPage } from './app/PlayersPage'
import { PlayerFormPage } from './app/PlayerFormPage'
import { SettingsPage } from './app/SettingsPage'
import { CreateGameWizard } from './components/game/CreateGameWizard'

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  )
}

function AppWithSeasonLoader() {
  const user = useAuthStore(s => s.user)
  const loadSeasons = useSeasonStore(s => s.loadSeasons)

  useEffect(() => {
    if (user) loadSeasons()
  }, [user?.id])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/accept-invite" element={<AcceptInvitePage />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />

        {/* Games */}
        <Route path="/games" element={<AppLayout><GamesPage /></AppLayout>} />
        <Route path="/games/new" element={
          <RequireAuth>
            <ManagerOnly><CreateGameWizard /></ManagerOnly>
          </RequireAuth>
        } />
        <Route path="/games/:id/log" element={
          <RequireAuth>
            <ManagerOnly><GameLogPage /></ManagerOnly>
          </RequireAuth>
        } />
        <Route path="/games/:id/edit" element={
          <RequireAuth>
            <ManagerOnly><GameEditPage /></ManagerOnly>
          </RequireAuth>
        } />
        <Route path="/games/:id/stats" element={<AppLayout><GameStatsPage /></AppLayout>} />

        {/* Trainings */}
        <Route path="/trainings" element={<AppLayout><TrainingsPage /></AppLayout>} />
        <Route path="/trainings/new" element={
          <RequireAuth>
            <ManagerOnly><TrainingFormPage /></ManagerOnly>
          </RequireAuth>
        } />
        <Route path="/trainings/:id" element={<AppLayout><TrainingDetailPage /></AppLayout>} />
        <Route path="/trainings/:id/edit" element={
          <RequireAuth>
            <ManagerOnly><TrainingFormPage /></ManagerOnly>
          </RequireAuth>
        } />

        {/* Players */}
        <Route path="/players" element={<AppLayout><PlayersPage /></AppLayout>} />
        <Route path="/players/new" element={
          <RequireAuth>
            <ManagerOnly><PlayerFormPage /></ManagerOnly>
          </RequireAuth>
        } />
        <Route path="/players/:id" element={<AppLayout><PlayerFormPage /></AppLayout>} />

        {/* Settings */}
        <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppWithSeasonLoader />
    </ToastProvider>
  )
}

export default App
