import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { AUTH_STORAGE_KEY, clearAuth, readAuth, writeAuth } from '../services/api'

export const AuthContext = createContext(null)

/** Where a role belongs once it is signed in. */
export const portalPathForRole = (role) => {
  switch (String(role || '').toUpperCase()) {
    case 'STUDENT':
    case 'STAFF':
      return '/student'
    case 'AUTHOR':
      return '/author'
    case 'LIBRARIAN':
      return '/librarian'
    default:
      return '/'
  }
}

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => readAuth())

  // Signing out in one tab must not leave another tab holding a stale session.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return
      setAuth(readAuth())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback((record) => {
    const stored = writeAuth(record)
    setAuth(stored)
    return stored
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setAuth(null)
  }, [])

  const updateAuth = useCallback((patch) => {
    setAuth((current) => {
      if (!current) return current
      return writeAuth({ ...current, ...patch })
    })
  }, [])

  const value = useMemo(() => ({
    auth,
    token: auth?.token ?? null,
    userId: auth?.userId ?? null,
    username: auth?.username ?? '',
    fullName: auth?.fullName ?? '',
    role: auth?.role ?? '',
    isAuthenticated: Boolean(auth?.token),
    login,
    logout,
    updateAuth,
  }), [auth, login, logout, updateAuth])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
