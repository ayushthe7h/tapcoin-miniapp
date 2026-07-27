import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { Skeleton } from '../components/Loader'
import UsdtLogo from '../components/UsdtLogo'
import { formatUsdt } from '../utils/format'

export default function Referral() {
  const { push } = useToast()
  const [ref, setRef] = useState(null)
  const [tab, setTab] = useState('history') // 'history' | 'leaderboard'
  const [history, setHistory] = useState(null)
  const [board, setBoard] = useState(null)
  const [boardType, setBoardType] = useState('balance')

  useEffect(() => {
    api.get('/api/referral/me').then((r) => setRef(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'history' && history === null) {
      api.get('/api/referral/history').then((r) => setHistory(r.data)).catch(() => setHistory([]))
    }
    if (tab === 'leaderboard') {
      api.get(`/api/leaderboard?type=${boardType}`).then((r) => setBoard(r.data)).catch(() => setBoard([]))
    }
  }, [tab, boardType])

  const copyLink = async () => {
    if (!ref) return
    try {
      await navigator.clipboard.writeText(ref.referral_link)
      push('Link copied!', 'success')
    } catch {
      push('Could not copy link', 'error')
    }
  }

  const shareLink = () => {
    if (!ref) return
    const url = `https://t.me/share/url?url=${encodeURIComponent(ref.referral_link)}&text=${encodeURIComponent(
      'Join me and start earning USDT!'
    )}`
    window.Telegram?.WebApp?.openTelegramLink ? window.Telegram.WebApp.openTelegramLink(url) : window.open(url, '_blank')
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="mb-4 font-display text-xl font-bold text-ink-primary">Invite Friends</h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass mb-4 rounded-3xl p-5 shadow-glass">
        <p className="text-xs uppercase tracking-wider text-ink-faint">Your Referral Code</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-amber-glow">
          {ref?.referral_code || <Skeleton className="h-8 w-32" />}
        </p>
        <p className="mt-3 text-xs text-ink-muted">
          Earn <span className="font-semibold text-ink-primary">{ref ? formatUsdt(ref.reward_per_referral) : '...'}</span> for every friend who joins.
        </p>

        <div className="mt-4 flex gap-2">
          <button onClick={copyLink} className="flex-1 rounded-2xl bg-white/5 py-2.5 font-display text-sm font-semibold text-ink-primary transition-transform active:scale-95">
            Copy Link
          </button>
          <button onClick={shareLink} className="flex-1 rounded-2xl bg-coin-gradient py-2.5 font-display text-sm font-semibold text-base-bg shadow-glow transition-transform active:scale-95">
            Share
          </button>
        </div>
      </motion.div>

      <div className="mb-3 flex gap-2">
        <div className="glass flex-1 rounded-2xl p-3 text-center shadow-glass">
          <p className="text-xs text-ink-faint">Total Referrals</p>
          <p className="font-mono text-xl font-bold text-ink-primary">{ref?.total_referrals ?? 0}</p>
        </div>
        <div className="glass flex-1 rounded-2xl p-3 text-center shadow-glass">
          <p className="text-xs text-ink-faint">Total Earnings</p>
          <div className="flex items-center justify-center gap-1">
            <UsdtLogo size={13} />
            <p className="font-mono text-xl font-bold text-ink-primary">
              {ref ? formatUsdt(ref.total_referral_earnings, { withSuffix: false }) : '0.00'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex gap-2 rounded-2xl bg-white/5 p-1">
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>History</TabButton>
        <TabButton active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>Leaderboard</TabButton>
      </div>

      {tab === 'leaderboard' && (
        <div className="mb-3 flex gap-2">
          <SmallToggle active={boardType === 'balance'} onClick={() => setBoardType('balance')}>Top Earners</SmallToggle>
          <SmallToggle active={boardType === 'referrals'} onClick={() => setBoardType('referrals')}>Top Referrals</SmallToggle>
        </div>
      )}

      <div className="space-y-2">
        {tab === 'history' &&
          (history === null ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : history.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-muted">No referrals yet — share your link to get started.</p>
          ) : (
            history.map((h, i) => (
              <div key={i} className="glass flex items-center justify-between rounded-2xl px-4 py-3 shadow-glass">
                <span className="text-sm text-ink-primary">{h.first_name || h.username || 'Friend'}</span>
                <span className="font-mono text-xs font-semibold text-amber-glow">+{formatUsdt(h.reward_amount)}</span>
              </div>
            ))
          ))}

        {tab === 'leaderboard' &&
          (board === null ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : (
            board.map((b) => (
              <div key={b.rank} className="glass flex items-center justify-between rounded-2xl px-4 py-3 shadow-glass">
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-sm font-bold ${b.rank <= 3 ? 'text-amber-glow' : 'text-ink-faint'}`}>
                    #{b.rank}
                  </span>
                  <span className="text-sm text-ink-primary">{b.first_name || b.username || 'Player'}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-ink-primary">
                  {boardType === 'balance' ? formatUsdt(b.value) : b.value.toLocaleString()}
                </span>
              </div>
            ))
          ))}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2 font-display text-xs font-semibold transition-colors ${
        active ? 'bg-white/10 text-ink-primary' : 'text-ink-faint'
      }`}
    >
      {children}
    </button>
  )
}

function SmallToggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-violet-glow/20 text-violet-glow' : 'bg-white/5 text-ink-faint'
      }`}
    >
      {children}
    </button>
  )
}
