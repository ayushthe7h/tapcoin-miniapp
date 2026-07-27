import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'
import { Skeleton } from '../../components/Loader'

const CARDS = [
  ['total_users', 'Total Users'],
  ['active_users_7d', 'Active (7d)'],
  ['today_users', "Today's Users"],
  ['usdt_generated', 'USDT Generated'],
  ['tasks_completed', 'Tasks Completed'],
  ['referral_count', 'Referrals'],
  ['daily_claims_today', "Today's Claims"],
]

export default function AdminOverview() {
  const [data, setData] = useState(null)

  useEffect(() => {
    adminApi.get('/api/admin/dashboard').then((r) => setData(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-bold text-ink-primary">Overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map(([key, label]) => (
          <div key={key} className="glass rounded-2xl p-4 shadow-glass">
            <p className="text-xs text-ink-faint">{label}</p>
            <p className="mt-1 font-mono text-xl font-bold text-ink-primary">
              {data ? (
                key === 'usdt_generated'
                  ? `${Number(data[key]).toFixed(2)} USDT`
                  : Number(data[key]).toLocaleString()
              ) : (
                <Skeleton className="h-6 w-16" />
              )}
            </p>
          </div>
        ))}
      </div>

      <h3 className="mb-3 mt-8 font-display text-sm font-bold text-ink-primary">Top Users by Balance</h3>
      <div className="glass rounded-2xl shadow-glass">
        {data?.top_users?.map((u, i) => (
          <div key={i} className="flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-0">
            <span className="text-sm text-ink-primary">{u.first_name || u.username || 'Player'}</span>
            <span className="font-mono text-sm font-semibold text-amber-glow">{Number(u.balance).toFixed(2)} USDT</span>
          </div>
        )) || <div className="p-4"><Skeleton className="h-20 w-full" /></div>}
      </div>
    </div>
  )
}
