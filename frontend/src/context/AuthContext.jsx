import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const login = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tg = window.Telegram?.WebApp
      tg?.ready()
      tg?.expand()

      const initData = tg?.initData || ''
      const startParam = tg?.initDataUnsafe?.start_param || null

      if (!initData) {
        // Not running inside Telegram — show a friendly message instead of crashing.
        setError('Please open this app from Telegram.')
        setLoading(false)
        return
      }

      const res = await api.post('/api/auth/telegram', {
        init_data: initData,
        start_param: startParam,
      })
      localStorage.setItem('tapcoin_token', res.data.access_token)
      setUser(res.data.user)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/profile/me')
      setUser(res.data)
    } catch {
      // ignore — token might be stale; next tap/reload will re-auth
    }
  }, [])

  useEffect(() => {
    login()
  }, [login])

  return (
    <AuthContext.Provider value={{ user, setUser, loading, error, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
