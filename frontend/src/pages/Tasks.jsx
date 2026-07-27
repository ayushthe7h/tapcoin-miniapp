import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Skeleton } from '../components/Loader'

const TYPE_ICON = {
  telegram_channel: '📢',
  telegram_group: '👥',
  twitter: '🐦',
  website: '🌐',
  youtube: '▶️',
  discord: '💬',
  custom_link: '🔗',
}

export default function Tasks() {
  const { refreshUser } = useAuth()
  const { push } = useToast()
  const [tasks, setTasks] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () => api.get('/api/tasks').then((r) => setTasks(r.data)).catch(() => setTasks([]))

  useEffect(() => {
    load()
  }, [])

  const handleTask = async (task) => {
    if (task.completed || busyId) return
    // Open the task's link first
    if (task.link) {
      window.Telegram?.WebApp?.openLink ? window.Telegram.WebApp.openLink(task.link) : window.open(task.link, '_blank')
    }
    setBusyId(task.id)
    try {
      await api.post(`/api/tasks/${task.id}/complete`)
      push(`+${Number(task.reward).toFixed(2)} USDT earned!`, 'success')
      await refreshUser()
      load()
    } catch (e) {
      push(e?.response?.data?.detail || 'Could not complete task', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6">
      <h1 className="mb-4 font-display text-xl font-bold text-ink-primary">Tasks</h1>

      {tasks === null && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {tasks?.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-muted">No tasks available right now — check back soon.</p>
      )}

      <div className="space-y-3">
        {tasks?.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass flex items-center justify-between rounded-3xl p-4 shadow-glass"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-xl">
                {TYPE_ICON[task.task_type] || '🔗'}
              </div>
              <div>
                <p className="font-display text-sm font-semibold text-ink-primary">{task.title}</p>
                {task.description && <p className="text-xs text-ink-muted">{task.description}</p>}
                <p className="mt-0.5 font-mono text-xs font-semibold text-amber-glow">+{Number(task.reward).toFixed(2)} USDT</p>
              </div>
            </div>
            <button
              onClick={() => handleTask(task)}
              disabled={task.completed || busyId === task.id}
              className={`shrink-0 rounded-2xl px-4 py-2 font-display text-xs font-bold transition-opacity ${
                task.completed
                  ? 'bg-white/5 text-ink-faint'
                  : 'bg-coin-gradient text-base-bg shadow-glow'
              }`}
            >
              {task.completed ? 'Done' : busyId === task.id ? '...' : task.button_text}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
