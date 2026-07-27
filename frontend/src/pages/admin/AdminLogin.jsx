import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/client'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.post('/api/admin/login', { username, password })
      localStorage.setItem('tapcoin_admin_token', res.data.access_token)
      navigate('/admin/dashboard')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-gradient px-4">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-3xl p-6 shadow-glass">
        <h1 className="mb-1 font-display text-xl font-bold text-ink-primary">Admin Login</h1>
        <p className="mb-5 text-xs text-ink-muted">Sign in to manage the TapCoin app.</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-ink-faint">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-ink-primary outline-none ring-1 ring-white/10 focus:ring-violet-glow"
            autoComplete="username"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-ink-faint">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-ink-primary outline-none ring-1 ring-white/10 focus:ring-violet-glow"
            autoComplete="current-password"
          />
        </label>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-coin-gradient py-2.5 font-display text-sm font-bold text-base-bg shadow-glow disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
