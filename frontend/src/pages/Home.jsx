import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import EnergyBar from '../components/EnergyBar'
import { Skeleton } from '../components/Loader'
import AnimatedCounter from '../components/AnimatedCounter'
import UsdtLogo from '../components/UsdtLogo'
import { formatUsdt, formatCountdown } from '../utils/format'

export default function Home() {
  const { user, refreshUser } = useAuth()
  const { push } = useToast()
  const [status, setStatus] = useState(null)
  const [daily, setDaily] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [claiming, setClaiming] = useState(false)
  const [justClaimed, setJustClaimed] = useState(false)

  useEffect(() => {
    api.get('/api/mining/status').then((r) => setStatus(r.data)).catch(() => {})
    api.get('/api/daily-reward/status').then((r) => setDaily(r.data)).catch(() => {})
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const claimDaily = async () => {
    if (!daily?.can_claim || claiming) return
    setClaiming(true)
    try {
      const res = await api.post('/api/daily-reward/claim')
      setDaily(res.data)
      await refreshUser()
      push(`+${res.data.reward_coins} Coins (${formatUsdt(res.data.reward_usdt)}) claimed!`, 'success')
      setJustClaimed(true)
      setTimeout(() => setJustClaimed(false), 1400)
    } catch (e) {
      push(e?.response?.data?.detail || 'Could not claim reward', 'error')
    } finally {
      setClaiming(false)
    }
  }

  const nextClaimMs = daily?.next_claim_at ? new Date(daily.next_claim_at).getTime() - now : 0
  const energyResetMs = status?.energy_reset_at ? new Date(status.energy_reset_at).getTime() - now : 0

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      {/* Profile header */}
      <div className="mb-5 flex items-center gap-3">
        {user?.photo_url ? (
          <img src={user.photo_url} alt="" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/10" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-glow/20 font-display text-lg font-bold text-violet-glow ring-2 ring-white/10">
            {(user?.first_name || 'U')[0]}
          </div>
        )}
        <div>
          <p className="font-display text-base font-semibold text-ink-primary">
            {user?.first_name || 'Player'} {user?.last_name || ''}
          </p>
          <p className="text-xs text-ink-muted">@{user?.username || 'guest'}</p>
        </div>
      </div>

      {/* Balance hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass mb-4 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent p-5 shadow-glass"
      >
        <p className="text-xs uppercase tracking-wider text-ink-faint">Total Balance</p>
        <div className="mt-1 flex items-baseline gap-2">
          <UsdtLogo size={22} className="mb-0.5" />
          <AnimatedCounter
            value={user?.balance ?? 0}
            formatter={(v) => formatUsdt(v, { withSuffix: false })}
            className="font-mono text-4xl font-bold text-ink-primary"
          />
          <span className="font-display text-sm font-semibold text-amber-glow">USDT</span>
        </div>

        <div className="mt-4">
          {status ? (
            <>
              <EnergyBar energy={status.energy} maxEnergy={status.max_energy} />
              {status.energy_reset_at && (
                <p className="mt-2 text-[11px] text-ink-faint">
                  Full reset in <span className="font-mono text-ink-muted">{formatCountdown(energyResetMs)}</span>
                </p>
              )}
            </>
          ) : (
            <Skeleton className="h-6 w-full" />
          )}
        </div>
      </motion.div>

      {/* Daily reward */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={claimDaily}
        disabled={!daily?.can_claim || claiming}
        className={`glass relative mb-4 flex w-full items-center justify-between overflow-hidden rounded-3xl p-4 shadow-glass transition-opacity ${
          !daily?.can_claim ? 'opacity-70' : ''
        }`}
      >
        <AnimatePresence>
          {justClaimed && (
            <motion.div
              initial={{ opacity: 0.6, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 bg-coin-gradient"
            />
          )}
        </AnimatePresence>
        <div className="relative text-left">
          <p className="font-display text-sm font-semibold text-ink-primary">Daily Reward</p>
          <p className="text-xs text-ink-muted">
            {daily
              ? daily.can_claim
                ? `Claim +${daily.reward_coins} Coins (${formatUsdt(daily.reward_usdt)})`
                : `Next reward in ${formatCountdown(nextClaimMs)}`
              : '...'}
          </p>
        </div>
        <div className={`relative rounded-2xl px-4 py-2 font-display text-sm font-bold ${
          daily?.can_claim ? 'bg-coin-gradient text-base-bg shadow-glow' : 'bg-white/5 text-ink-faint'
        }`}>
          {claiming ? '...' : daily?.can_claim ? 'Claim' : `🔥 ${daily?.current_streak ?? 0}`}
        </div>
      </motion.button>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-3xl p-4 shadow-glass">
          <p className="text-xs text-ink-faint">Referrals</p>
          <p className="font-mono text-xl font-bold text-ink-primary">{user?.total_referrals ?? 0}</p>
        </div>
        <div className="glass rounded-3xl p-4 shadow-glass">
          <p className="text-xs text-ink-faint">Reward / Tap</p>
          <p className="font-mono text-xl font-bold text-ink-primary">
            {status ? `+${formatUsdt(status.reward_per_tap)}` : <Skeleton className="h-5 w-10" />}
          </p>
        </div>
      </div>
    </div>
  )
}
