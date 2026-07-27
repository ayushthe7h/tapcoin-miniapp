import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'
import { useToast } from '../context/ToastContext'
import { Skeleton } from '../components/Loader'
import UsdtLogo from '../components/UsdtLogo'
import AnimatedCounter from '../components/AnimatedCounter'
import { formatUsdt } from '../utils/format'

// Trust Wallet / OKX / Binance Wallet are trademarked products — rather than
// reproduce their logo artwork, each option gets a distinct colored badge and
// initial so they stay easy to tell apart without using licensed marks.
const WALLETS = [
  { id: 'trust', name: 'Trust Wallet', color: '#3375BB', initial: 'T' },
  { id: 'okx', name: 'OKX Wallet', color: '#000000', initial: 'OK' },
  { id: 'binance', name: 'Binance Wallet', color: '#F0B90B', dark: true, initial: 'B' },
]

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/

export default function Wallet() {
  const { push } = useToast()
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // wallet id being edited, or null
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/api/wallet/me')
      .then((r) => setWallet(r.data))
      .catch(() => push('Could not load wallet', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const startEdit = (id) => {
    setEditing(id)
    setAddress(wallet?.wallet_type === id ? wallet.wallet_address || '' : '')
  }

  const save = async () => {
    const trimmed = address.trim()
    if (!EVM_ADDRESS.test(trimmed)) {
      push('Enter a valid USDT (Polygon) address — 42 characters starting with 0x', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await api.post('/api/wallet/connect', { wallet_type: editing, address: trimmed })
      setWallet(res.data)
      setEditing(null)
      push('Wallet connected', 'success')
    } catch (e) {
      push(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || 'Could not save wallet', 'error')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    setSaving(true)
    try {
      const res = await api.delete('/api/wallet/connect')
      setWallet(res.data)
      setEditing(null)
      push('Wallet disconnected', 'success')
    } catch {
      push('Could not disconnect wallet', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="mb-4 font-display text-xl font-bold text-ink-primary">Wallet</h1>

      <div className="glass mb-5 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent p-5 shadow-glass">
        <p className="text-xs uppercase tracking-wider text-ink-faint">Available Balance</p>
        <div className="mt-1 flex items-center gap-2">
          <UsdtLogo size={20} />
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <AnimatedCounter
              value={wallet?.balance ?? 0}
              formatter={(v) => formatUsdt(v, { withSuffix: false })}
              className="font-mono text-3xl font-bold text-ink-primary"
            />
          )}
          <span className="font-display text-sm font-semibold text-amber-glow">USDT</span>
        </div>
      </div>

      <p className="mb-3 text-xs uppercase tracking-wider text-ink-faint">Connect a Wallet</p>

      <div className="space-y-3">
        {WALLETS.map((w) => {
          const isConnected = wallet?.wallet_type === w.id && wallet?.wallet_connected
          const isEditing = editing === w.id
          return (
            <motion.div key={w.id} layout className="glass overflow-hidden rounded-3xl shadow-glass">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl font-display text-sm font-bold"
                    style={{ backgroundColor: w.color, color: w.dark ? '#0A0C16' : '#fff' }}
                  >
                    {w.initial}
                  </div>
                  <div>
                    <p className="font-display text-sm font-semibold text-ink-primary">{w.name}</p>
                    {isConnected && (
                      <p className="max-w-[160px] truncate font-mono text-[11px] text-ink-faint">{wallet.wallet_address}</p>
                    )}
                  </div>
                </div>

                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : isConnected ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                    ● Connected
                  </span>
                ) : (
                  <button
                    onClick={() => startEdit(w.id)}
                    className="rounded-xl bg-white/5 px-3 py-1.5 font-display text-xs font-semibold text-ink-primary transition-transform active:scale-95"
                  >
                    Connect
                  </button>
                )}
              </div>

              <AnimatePresence>
                {(isEditing || (isConnected && editing === w.id)) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 p-4"
                  >
                    <label className="mb-1.5 block text-xs text-ink-muted">USDT Polygon Address</label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-xl bg-white/5 px-3 py-2.5 font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-violet-glow/40"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setEditing(null)}
                        className="flex-1 rounded-xl bg-white/5 py-2 font-display text-xs font-semibold text-ink-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={save}
                        disabled={saving}
                        className="flex-1 rounded-xl bg-coin-gradient py-2 font-display text-xs font-semibold text-base-bg shadow-glow"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {isConnected && editing !== w.id && (
                  <div className="flex gap-2 border-t border-white/5 p-3">
                    <button
                      onClick={() => startEdit(w.id)}
                      className="flex-1 rounded-xl bg-white/5 py-2 font-display text-xs font-semibold text-ink-primary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={disconnect}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-red-500/10 py-2 font-display text-xs font-semibold text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
