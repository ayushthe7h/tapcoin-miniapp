// Generic Solana mark (gradient circle + "S") — not the official trademarked
// logo artwork, just enough to visually flag "this is a SOL address/amount".
export default function SolLogo({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="solGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="url(#solGrad)" />
      <g fill="#0A0C16">
        <rect x="9" y="11" width="14" height="2.4" rx="1.2" />
        <rect x="9" y="15.3" width="14" height="2.4" rx="1.2" />
        <rect x="9" y="19.6" width="14" height="2.4" rx="1.2" />
      </g>
    </svg>
  )
}
