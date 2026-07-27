import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import EnergyBar from '../components/EnergyBar'
import AnimatedCounter from '../components/AnimatedCounter'
import UsdtLogo from '../components/UsdtLogo'
import { formatUsdt, formatCountdown } from '../utils/format'

const FLUSH_INTERVAL_MS = 350
// Pending, not-yet-flushed taps are mirrored into localStorage on every single
// tap (not just on the flush interval). If the Mini App is force-closed or
// refreshed before the 350ms flush timer fires, this is what lets us recover
// and resend those taps the next time the app opens — this is the fix for
// "reopening the app resets my taps". The server remains the source of truth
// for the actual balance; this is only a client-side replay queue.
const PENDING_KEY = 'tapcoin_pending_taps'

function readPending() {
  const n = Number(localStorage.getItem(PENDING_KEY) || 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function writePending(n) {
  if (n > 0) localStorage.setItem(PENDING_KEY, String(n))
  else localStorage.removeItem(PENDING_KEY)
}

export default function Tap() {
  const { user, setUser } = useAuth()
  const { push } = useToast()
  const [status, setStatus] = useState(null)
  const [floaters, setFloaters] = useState([])
  const [pressed, setPressed] = useState(false)
  const [now, setNow] = useState(Date.now())

  const pendingTaps = useRef(readPending())
  const flushing = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const flush = useCallback(async () => {
    if (flushing.current || pendingTaps.current === 0) return
    const taps = pendingTaps.current

    pendingTaps.current = 0
    writePending(0)
    flushing.current = true
    try {
      const res = await api.post('/api/mining/tap', { taps })
      setStatus(res.data)
      setUser((u) => (u ? { ...u, balance: res.data.balance } : u))
    } catch (e) {
      if (e?.response?.status === 429) {
        push('Slow down a little!', 'error')
      } else if (e?.response?.status === 400) {
        push('Out of energy — wait for it to regenerate', 'error')
      } else {
        // Network/server error — put the taps back in the queue so the next
        // flush (or the next app open) retries them instead of losing them.
        pendingTaps.current += taps
        writePending(pendingTaps.current)
      }
      api.get('/api/mining/status').then((r) => setStatus(r.data)).catch(() => {})
    } finally {
      flushing.current = false
    }
  }, [push, setUser])

  useEffect(() => {
    // On mount: resync with the server, then immediately try to replay any
    // taps that were queued locally but never made it to the server (e.g.
    // the app was killed mid-session last time).
    api.get('/api/mining/status').then((r) => setStatus(r.data)).catch(() => {})
    if (pendingTaps.current > 0) flush()
  }, [flush])

  useEffect(() => {
    const id = setInterval(flush, FLUSH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [flush])

  useEffect(() => {
    // Flush eagerly whenever the Mini App is about to go into the background —
    // covers minimizing, switching tabs, and closing. Combined with the
    // localStorage-backed pending queue above, taps are never silently lost:
    // either this flush completes, or the queued count survives to be
    // replayed the next time the app opens.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [flush])

  const handleTap = (e) => {
    if (!status || status.energy <= 0) {
      push('Out of energy!', 'error')
      return
    }
    // Optimistic local feedback only — server has final say on balance
    setStatus((s) => (s ? { ...s, energy: Math.max(0, s.energy - s.energy_per_tap), balance: s.balance + s.reward_per_tap } : s))
    pendingTaps.current += 1
    writePending(pendingTaps.current)

    const id = Math.random().toString(36).slice(2)
    const touch = e.touches?.[0]
    const x = touch ? touch.clientX : e.clientX
    const y = touch ? touch.clientY : e.clientY
    setFloaters((f) => [...f, { id, x, y, value: status.reward_per_tap }])
    setTimeout(() => setFloaters((f) => f.filter((fl) => fl.id !== id)), 900)

    setPressed(true)
    setTimeout(() => setPressed(false), 100)
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light')
    }
  }

  const resetMs = status?.energy_reset_at ? new Date(status.energy_reset_at).getTime() - now : 0

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 pb-28 pt-8">
      <div className="mb-1 flex items-center gap-2">
        <UsdtLogo size={26} />
        <AnimatedCounter
          value={status?.balance ?? user?.balance ?? 0}
          formatter={(v) => formatUsdt(v, { withSuffix: false })}
          className="font-mono text-3xl font-bold text-ink-primary"
        />
      </div>
      <p className="mb-8 text-xs uppercase tracking-widest text-ink-faint">USDT Balance</p>

      <div className="relative flex h-72 w-72 items-center justify-center">
        <div className="absolute h-full w-full rounded-full border border-amber-glow/20 animate-pulse-ring" />
        <motion.button
          onTouchStart={handleTap}
          onMouseDown={handleTap}
          animate={{ scale: pressed ? 0.94 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          className="relative flex h-56 w-56 select-none items-center justify-center rounded-full bg-coin-gradient shadow-glow"
          style={{ touchAction: 'manipulation' }}
        >
          <CoinFace />
        </motion.button>

        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -70 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="pointer-events-none fixed z-50 font-display text-xl font-bold text-amber-glow"
              style={{ left: f.x - 10, top: f.y - 20 }}
            >
              +{formatUsdt(f.value, { withSuffix: false })}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8 w-full">
        {status && <EnergyBar energy={status.energy} maxEnergy={status.max_energy} />}
        {status?.energy_reset_at && (
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            Full energy reset in <span className="font-mono text-ink-muted">{formatCountdown(resetMs)}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function CoinFace() {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#0A0C16" strokeWidth="1.5" fill="none" opacity="0.3" />
      <path d="M12 6v12M9 8.5c0-1 1-1.8 3-1.8s3 .9 3 2c0 2.6-6 1.4-6 4 0 1.1 1 2 3 2s3-.8 3-1.8" stroke="#0A0C16" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
