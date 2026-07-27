// Shared USDT formatting helpers used across the app so every screen
// (balance, tap rewards, leaderboard, wallet, admin) renders amounts
// identically — e.g. "12.35 USDT" — regardless of internal precision.

export function formatUsdt(value, { withSuffix = true } = {}) {
  const n = Number(value ?? 0)
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return withSuffix ? `${formatted} USDT` : formatted
}

export function formatUsdtPrecise(value) {
  // Used where the extra precision behind the 2-decimal display actually
  // matters (e.g. summing many 0.01 taps) — still trims trailing zeros.
  const n = Number(value ?? 0)
  return `${n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} USDT`
}

export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00'
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `${h}:${m}:${s}`
}
