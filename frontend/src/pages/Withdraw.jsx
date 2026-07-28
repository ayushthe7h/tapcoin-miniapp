import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Skeleton } from '../components/Loader'
import UsdtLogo from '../components/UsdtLogo'
import SolLogo from '../components/SolLogo'
import ProgressTracker from '../components/ProgressTracker'
import { formatUsdt, formatCountdown } from '../utils/format'

const WALLET_TYPES = [
  { id: 'trust', label: 'Trust Wallet' },
  { id: 'okx', label: 'OKX Wallet' },
  { id: 'binance', label: 'Binance Wallet' },
  { id: 'other', label: 'Other' },
]

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/

export default function Withdraw() {
  const { user, refreshUser } = useAuth()
  const { push } = useToast()

  const [settings, setSettings] = useState(null)
  const [active, setActive] = useState(undefined) // undefined = loading, null = none
  const [history, setHistory] = useState(null)

  const [amount, setAmount] = useState('')
  const [walletType, setWalletType] = useState('trust')
  const [walletAddress, setWalletAddress] = useState('')

  const [modalStep, setModalStep] = useState(null) // null | 'gasfee' | 'txn'
  const [paidClicked, setPaidClicked] = useState(false)
  const [txnId, setTxnId] = useState('')
  const [now, setNow] = useState(Date.now())
  const [deadline, setDeadline] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadActive = useCallback(() => {
    api.get('/api/withdraw/active').then((r) => setActive(r.data)).catch(() => setActive(null))
  }, [])

  useEffect(() => {
    api.get('/api/withdraw/settings').then((r) => setSettings(r.data)).catch(() => {})
    loadActive()
    api.get('/api/withdraw/history').then((r) => setHistory(r.data)).catch(() => setHistory([]))
  }, [loadActive])

  useEffect(() => {
    // Poll the active request so the progress tracker updates as an admin acts on it.
    if (!active) return
    const id = setInterval(loadActive, 6000)
    return () => clearInterval(id)
  }, [active, loadActive])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const openGasFeeModal = () => {
    const amt = Number(amount)
    if (!amt || amt <= 0) return push('Enter a valid amount', 'error')
    if (settings && amt < settings.min_withdrawal) return push(`Minimum withdrawal is ${formatUsdt(settings.min_withdrawal)}`, 'error')
    if (settings?.max_withdrawal > 0 && amt > settings.max_withdrawal) return push(`Maximum withdrawal is ${formatUsdt(settings.max_withdrawal)}`, 'error')
    if (amt > Number(user?.balance ?? 0)) return push('Insufficient balance', 'error')
    if (!EVM_ADDRESS.test(walletAddress.trim())) return push('Enter a valid USDT (Polygon) address', 'error')

    setDeadline(Date.now() + (settings?.request_validity_minutes ?? 30) * 60000)
    setModalStep('gasfee')
  }

  const copyGasAddress = async () => {
    try {
      await navigator.clipboard.writeText(settings.gas_fee_wallet_address)
      push('Address copied!', 'success')
    } catch {
      push('Could not copy', 'error')
    }
  }

  const submitWithdrawal = async () => {
    if (!txnId.trim()) return push('Transaction ID is required', 'error')
    setSubmitting(true)
    try {
      await api.post('/api/withdraw/request', {
        amount: Number(amount),
        wallet_address: walletAddress.trim(),
        wallet_type: walletType,
        gas_fee_txn_id: txnId.trim(),
      })
      push('Withdrawal request submitted', 'success')
      setModalStep(null)
      setPaidClicked(false)
      setTxnId('')
      setAmount('')
      setWalletAddress('')
      loadActive()
      api.get('/api/withdraw/history').then((r) => setHistory(r.data)).catch(() => {})
      refreshUser()
    } catch (e) {
      push(e?.response?.data?.detail?.[0]?.msg || e?.response?.data?.detail || 'Could not submit request', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const gasFeeMsLeft = deadline ? deadline - now : 0

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="mb-4 font-display text-xl font-bold text-ink-primary">Withdraw</h1>

      <div className="glass mb-5 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent p-5 shadow-glass">
        <p className="text-xs uppercase tracking-wider text-ink-faint">Available Balance</p>
        <div className="mt-1 flex items-center gap-2">
          <UsdtLogo size={20} />
          <span className="font-mono text-3xl font-bold text-ink-primary">{formatUsdt(user?.balance ?? 0, { withSuffix: false })}</span>
          <span className="font-display text-sm font-semibold text-amber-glow">USDT</span>
        </div>
        {settings && (
          <p className="mt-2 text-xs text-ink-faint">
            Min withdrawal: {formatUsdt(settings.min_withdrawal)}
            {settings.max_withdrawal > 0 && ` · Max: ${formatUsdt(settings.max_withdrawal)}`}
          </p>
        )}
      </div>

      {active === undefined ? (
        <Skeleton className="h-40 w-full rounded-3xl" />
      ) : active ? (
        <div className="space-y-3">
          <div className="glass rounded-3xl p-4 shadow-glass">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-ink-primary">Withdrawal Request</p>
              <span className="font-mono text-sm font-bold text-amber-glow">{formatUsdt(active.amount)}</span>
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">{active.wallet_address}</p>
          </div>
          <ProgressTracker gasFeeStatus={active.gas_fee_status} withdrawalStatus={active.withdrawal_status} />
          <p className="text-center text-xs text-ink-muted">
            {active.gas_fee_status === 'pending' ? 'Pending Gas Fee Verification' : 'Waiting for final approval'}
          </p>
        </div>
      ) : (
        <div className="glass space-y-4 rounded-3xl p-5 shadow-glass">
          <div>
            <label className="mb-1.5 block text-xs text-ink-muted">Withdrawal Amount (USDT)</label>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
              <UsdtLogo size={16} />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-ink-muted">Wallet Type</label>
            <div className="flex flex-wrap gap-2">
              {WALLET_TYPES.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWalletType(w.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    walletType === w.id ? 'bg-violet-glow/20 text-violet-glow' : 'bg-white/5 text-ink-faint'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-ink-muted">Wallet Address (USDT Polygon)</label>
            <input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-violet-glow/40"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openGasFeeModal}
            className="w-full rounded-2xl bg-coin-gradient py-3 font-display text-sm font-bold text-base-bg shadow-glow"
          >
            Withdraw
          </motion.button>
        </div>
      )}

      {/* History */}
      <p className="mb-2 mt-6 text-xs uppercase tracking-wider text-ink-faint">History</p>
      <div className="space-y-2">
        {history === null ? (
          [1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : history.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">No withdrawals yet.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="glass flex items-center justify-between rounded-2xl px-4 py-3 shadow-glass">
              <div>
                <p className="font-mono text-sm font-semibold text-ink-primary">{formatUsdt(h.amount)}</p>
                <p className="text-[11px] text-ink-faint">{new Date(h.created_at).toLocaleDateString()}</p>
              </div>
              <StatusBadge gasFee={h.gas_fee_status} withdrawal={h.withdrawal_status} />
            </div>
          ))
        )}
      </div>

      {/* Gas fee modal */}
      <AnimatePresence>
        {modalStep && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            onClick={() => setModalStep(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-md rounded-t-3xl p-6 shadow-glass sm:rounded-3xl"
            >
              {modalStep === 'gasfee' && !paidClicked && (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <SolLogo size={22} />
                    <h3 className="font-display text-base font-bold text-ink-primary">Network Processing Fee</h3>
                  </div>
                  <p className="mb-4 text-sm text-ink-muted">
                    To process your withdrawal you must pay a network processing fee of{' '}
                    <span className="font-semibold text-ink-primary">{settings?.gas_fee_sol} SOL</span>.
                  </p>

                  {settings && (
                    <div className="mb-4 flex justify-center rounded-2xl bg-white p-3">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(settings.gas_fee_wallet_address)}`}
                        alt="Gas fee address QR code"
                        width={180}
                        height={180}
                      />
                    </div>
                  )}

                  <div className="mb-4 rounded-xl bg-white/5 p-3">
                    <p className="mb-1 text-[11px] text-ink-faint">Payment Address</p>
                    <p className="break-all font-mono text-xs text-ink-primary">{settings?.gas_fee_wallet_address}</p>
                  </div>

                  <div className="mb-4 flex gap-2">
                    <button onClick={copyGasAddress} className="flex-1 rounded-xl bg-white/5 py-2.5 font-display text-xs font-semibold text-ink-primary active:scale-95">
                      Copy Address
                    </button>
                    <a
                      href={`solana:${settings?.gas_fee_wallet_address}?amount=${settings?.gas_fee_sol}`}
                      className="flex-1 rounded-xl bg-white/5 py-2.5 text-center font-display text-xs font-semibold text-ink-primary active:scale-95"
                    >
                      Open in Wallet
                    </a>
                  </div>

                  <p className="mb-4 text-center text-[11px] text-ink-faint">
                    Request valid for <span className="font-mono text-ink-muted">{formatCountdown(gasFeeMsLeft)}</span>
                  </p>

                  <button
                    onClick={() => setPaidClicked(true)}
                    className="w-full rounded-2xl bg-coin-gradient py-3 font-display text-sm font-bold text-base-bg shadow-glow"
                  >
                    I Have Paid
                  </button>
                  <button onClick={() => setModalStep(null)} className="mt-2 w-full py-2 text-center text-xs text-ink-faint">
                    Cancel
                  </button>
                </>
              )}

              {modalStep === 'gasfee' && paidClicked && (
                <>
                  <h3 className="mb-3 font-display text-base font-bold text-ink-primary">Enter Transaction ID</h3>
                  <p className="mb-3 text-sm text-ink-muted">
                    Paste the transaction ID/signature from your SOL payment to confirm.
                  </p>
                  <input
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                    placeholder="Transaction ID"
                    className="mb-4 w-full rounded-xl bg-white/5 px-3 py-2.5 font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-violet-glow/40"
                  />
                  <button
                    onClick={submitWithdrawal}
                    disabled={submitting}
                    className="w-full rounded-2xl bg-coin-gradient py-3 font-display text-sm font-bold text-base-bg shadow-glow"
                  >
                    {submitting ? 'Submitting...' : 'Submit Withdrawal Request'}
                  </button>
                  <button onClick={() => setPaidClicked(false)} className="mt-2 w-full py-2 text-center text-xs text-ink-faint">
                    Back
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusBadge({ gasFee, withdrawal }) {
  if (gasFee === 'rejected' || withdrawal === 'rejected') {
    return <span className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-semibold text-red-400">Rejected</span>
  }
  if (withdrawal === 'completed') {
    return <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-400">Completed</span>
  }
  if (gasFee === 'approved') {
    return <span className="rounded-full bg-amber-glow/15 px-3 py-1 text-[11px] font-semibold text-amber-glow">Processing</span>
  }
  return <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-ink-faint">Pending</span>
}
