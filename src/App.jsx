import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ChatProvider } from './context/ChatContext'
import { CallProvider } from './context/CallContext'
import LoginPage from './pages/LoginPage'
import ProfileSetupPage from './pages/ProfileSetupPage'
import MainLayout from './pages/MainLayout'
import AppLockScreen from './components/chat/AppLockScreen'
import { isAppLockEnabled, isUnlockedThisSession } from './lib/appLock'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading WaveChat...</span>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function ProfileRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (user && !profile?.display_name) return <Navigate to="/setup" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={
        <ProtectedRoute>
          <ProfileSetupPage />
        </ProtectedRoute>
      } />
      <Route path="/*" element={
        <ProfileRoute>
          <ChatProvider>
            <CallProvider>
              <MainLayout />
            </CallProvider>
          </ChatProvider>
        </ProfileRoute>
      } />
    </Routes>
  )
}

export default function App() {
  const [locked, setLocked] = useState(isAppLockEnabled() && !isUnlockedThisSession())

  // Re-check whenever the tab regains focus (covers the "left it open, came back" case)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && isAppLockEnabled() && !isUnlockedThisSession()) {
        setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return (
    <AuthProvider>
      {locked ? <AppLockScreen onUnlock={() => setLocked(false)} /> : <AppRoutes />}
    </AuthProvider>
  )
}