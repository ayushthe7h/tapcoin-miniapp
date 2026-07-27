export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 ${className}`} />
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-app-gradient gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-amber-glow" />
      <p className="text-sm text-ink-muted font-body">{label}</p>
    </div>
  )
}
