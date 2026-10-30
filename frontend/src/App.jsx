import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import CommandPalette from './components/CommandPalette'

import StoryLanding from './pages/StoryLanding'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Inventory from './pages/Inventory'
import Chat from './pages/Chat'
import Analytics from './pages/Analytics'
import Reports from './pages/Reports'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import Upload from './pages/Upload'
import Market from './pages/Market'

// Route Guard Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, hasRole, user } = useAuth()

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)] font-sans gap-3">
        <div className="w-8 h-8 rounded-[3px] bg-[var(--accent)] border-2 border-[var(--border-strong)] flex items-center justify-center text-[var(--accent-ink)] font-mono font-extrabold shadow-[2px_2px_0px_var(--border-strong)] animate-pulse">
          B
        </div>
        <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
          Initializing The Story of Your Business...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    const fallback = user?.role === 'EMPLOYEE' ? '/pos' : '/dashboard'
    return <Navigate to={fallback} replace />
  }

  return children
}

function AppRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Cinematic Storytelling Start Screen (Public) */}
        <Route path="/" element={<StoryLanding />} />
        <Route path="/story" element={<StoryLanding />} />

        {/* Public Login Kiosk */}
        <Route path="/login" element={<Login />} />

        {/* Authenticated Application Console */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute allowedRoles={['EMPLOYEE', 'MANAGER', 'OWNER']}>
                <POS />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <Market />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <Alerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <Upload />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'font-mono text-xs',
            style: {
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
            },
          }}
        />
        <CommandPalette />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
