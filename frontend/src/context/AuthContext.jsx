import React, { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('businessgpt_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('businessgpt_token'))
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('businessgpt_theme') || 'dark')

  useEffect(() => {
    // Apply theme class to root
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('businessgpt_theme', theme)
  }, [theme])

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('businessgpt_token')
      if (storedToken) {
        try {
          const res = await authAPI.getMe()
          setUser(res.data)
          localStorage.setItem('businessgpt_user', JSON.stringify(res.data))
        } catch (err) {
          console.error('Session expired or invalid:', err)
          localStorage.removeItem('businessgpt_token')
          localStorage.removeItem('businessgpt_user')
          setUser(null)
          setToken(null)
        }
      }
      setLoading(false)
    }
    checkAuth()
  }, [])

  const login = async (role, pin, userId = null) => {
    const payload = userId ? { user_id: userId, pin } : { role, pin }
    const res = await authAPI.login(payload)
    const { access_token, user: userData } = res.data

    localStorage.setItem('businessgpt_token', access_token)
    localStorage.setItem('businessgpt_user', JSON.stringify(userData))
    setToken(access_token)
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('businessgpt_token')
    localStorage.removeItem('businessgpt_user')
    setUser(null)
    setToken(null)
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const hasRole = (allowedRoles) => {
    if (!user || !user.role) return false
    const current = user.role.toUpperCase()
    if (current === 'OWNER') return true
    if (current === 'MANAGER') return allowedRoles.includes('MANAGER') || allowedRoles.includes('EMPLOYEE')
    if (current === 'EMPLOYEE') return allowedRoles.includes('EMPLOYEE')
    return false
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        theme,
        toggleTheme,
        login,
        logout,
        hasRole,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
