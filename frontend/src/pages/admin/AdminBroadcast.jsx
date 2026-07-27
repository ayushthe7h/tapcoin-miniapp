import { useState } from 'react'
import { adminApi } from '../../api/client'

export default function AdminBroadcast() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState('all')
  const [targetId, setTargetId] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const send = async (e) => {
    e.preventDefault()
    setSending(true)
    setResult(null)
    try {
      const res = await adminApi.post('/api/admin/broadcast', {
        title,
        message,
        target,
        target_telegram_id: target === 'single' ? Number(targetId) : null,
      })
      setResult(res.data)
      setTitle('')
      setMessage('')
    } catch (e) {
      setResult({ error: e?.response?.data?.detail || 'Broadcast failed' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-bold text-ink-primary">Broadcast</h2>
      <form onSubmit={send} className="glass max-w-lg space-y-3 rounded-2xl p-4 shadow-glass">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Message</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Target</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10">
            <option value="all">All Users</option>
            <option value="single">Single User (Telegram ID)</option>
          </select>
        </label>
        {target === 'single' && (
          <label className="block">
            <span className="mb-1 block text-xs text-ink-faint">Telegram ID</span>
            <input value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10" />
          </label>
        )}
        <button type="submit" disabled={sending} className="rounded-xl bg-coin-gradient px-5 py-2.5 font-display text-sm font-bold text-base-bg shadow-glow disabled:opacity-60">
          {sending ? 'Sending…' : 'Send Broadcast'}
        </button>
        {result && (
          <p className={`text-xs ${result.error ? 'text-red-400' : 'text-emerald-400'}`}>
            {result.error || `Sent to ${result.sent} users, ${result.failed} failed.`}
          </p>
        )}
      </form>
    </div>
  )
}
