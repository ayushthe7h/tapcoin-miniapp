import { motion } from 'framer-motion'

export default function EnergyBar({ energy, maxEnergy }) {
  const pct = maxEnergy > 0 ? Math.min(100, (energy / maxEnergy) * 100) : 0
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-ink-muted">
        <span className="flex items-center gap-1">
          <BoltIcon /> Energy
        </span>
        <span className="font-mono text-ink-primary">{energy} / {maxEnergy}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-glow to-violet-deep"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}

function BoltIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#7C5CFF">
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  )
}
