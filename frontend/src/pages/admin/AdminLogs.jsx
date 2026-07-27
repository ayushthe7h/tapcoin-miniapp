import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'

export default function AdminLogs() {
  const [logs, setLogs] = useState(null)

  useEffect(() => {
    adminApi.get('/api/admin/logs').then((r) => setLogs(r.data)).catch(() => setLogs([]))
  }, [])

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-bold text-ink-primary">Admin Action Logs</h2>
      <div className="glass rounded-2xl shadow-glass">
        {logs?.length === 0 && <p className="p-4 text-sm text-ink-muted">No actions logged yet.</p>}
        {logs?.map((l) => (
          <div key={l.id} className="border-b border-white/5 px-4 py-3 last:border-0">
            <p className="text-sm text-ink-primary">{l.action}</p>
            <p className="text-xs text-ink-faint">{l.admin} · {new Date(l.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
