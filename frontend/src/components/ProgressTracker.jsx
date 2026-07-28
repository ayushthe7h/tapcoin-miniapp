import { motion } from 'framer-motion'

const STEPS = ['Gas Fee Pending', 'Gas Fee Approved', 'Withdrawal Approved', 'Completed']

// Maps a withdrawal's (gas_fee_status, withdrawal_status) pair to a step index.
function stepIndex(gasFee, withdrawal) {
  if (withdrawal === 'completed') return 3
  if (gasFee === 'approved') return 2 // "Withdrawal Pending" — waiting for final approval
  return 0 // gas fee still pending
}

export default function ProgressTracker({ gasFeeStatus, withdrawalStatus }) {
  const rejected = gasFeeStatus === 'rejected' || withdrawalStatus === 'rejected'
  const current = stepIndex(gasFeeStatus, withdrawalStatus)

  if (rejected) {
    return (
      <div className="glass rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
        <p className="font-display text-sm font-semibold text-red-400">
          {gasFeeStatus === 'rejected' ? 'Gas Fee Rejected' : 'Withdrawal Rejected'}
        </p>
        <p className="mt-1 text-xs text-ink-muted">You can submit a new withdrawal request.</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-4 shadow-glass">
      {STEPS.map((label, i) => {
        const done = i < current || (i === current && withdrawalStatus === 'completed')
        const active = i === current && withdrawalStatus !== 'completed'
        return (
          <div key={label} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <motion.div
                animate={active ? { scale: [1, 1.15, 1] } : {}}
                transition={{ repeat: active ? Infinity : 0, duration: 1.4 }}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  done ? 'bg-emerald-500 text-base-bg' : active ? 'bg-amber-glow text-base-bg' : 'bg-white/10 text-ink-faint'
                }`}
              >
                {done ? '✓' : i + 1}
              </motion.div>
              {i < STEPS.length - 1 && (
                <div className={`h-8 w-0.5 ${i < current ? 'bg-emerald-500' : 'bg-white/10'}`} />
              )}
            </div>
            <p className={`pt-0.5 text-sm ${done || active ? 'text-ink-primary' : 'text-ink-faint'}`}>{label}</p>
          </div>
        )
      })}
    </div>
  )
}
