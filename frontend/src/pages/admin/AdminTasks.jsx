import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'

const EMPTY = { title: '', description: '', reward: 0, button_text: 'Open', link: '', icon: '', task_type: 'custom_link' }
const TYPES = ['telegram_channel', 'telegram_group', 'twitter', 'website', 'youtube', 'discord', 'custom_link']

export default function AdminTasks() {
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)

  const load = () => adminApi.get('/api/admin/tasks').then((r) => setTasks(r.data))

  useEffect(() => {
    load()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (editingId) {
      await adminApi.put(`/api/admin/tasks/${editingId}`, form)
    } else {
      await adminApi.post('/api/admin/tasks', form)
    }
    setForm(EMPTY)
    setEditingId(null)
    load()
  }

  const edit = (t) => {
    setEditingId(t.id)
    setForm({
      title: t.title, description: t.description || '', reward: t.reward,
      button_text: t.button_text, link: t.link, icon: t.icon || '', task_type: t.task_type,
    })
  }

  const remove = async (id) => {
    await adminApi.delete(`/api/admin/tasks/${id}`)
    load()
  }

  const toggleActive = async (t) => {
    await adminApi.put(`/api/admin/tasks/${t.id}`, { is_active: t.completed }) // 'completed' repurposed as !active flag from admin list endpoint
    load()
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-bold text-ink-primary">Tasks</h2>

      <form onSubmit={submit} className="glass mb-6 grid grid-cols-1 gap-3 rounded-2xl p-4 shadow-glass sm:grid-cols-2">
        <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
        <Input label="Reward" type="number" value={form.reward} onChange={(v) => setForm({ ...form, reward: Number(v) })} />
        <Input label="Link" value={form.link} onChange={(v) => setForm({ ...form, link: v })} required />
        <Input label="Button Text" value={form.button_text} onChange={(v) => setForm({ ...form, button_text: v })} />
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Type</span>
          <select
            value={form.task_type}
            onChange={(e) => setForm({ ...form, task_type: e.target.value })}
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <Input label="Icon (emoji/url)" value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
        <label className="col-span-full block">
          <span className="mb-1 block text-xs text-ink-faint">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10"
          />
        </label>
        <div className="col-span-full flex gap-2">
          <button type="submit" className="rounded-xl bg-coin-gradient px-4 py-2 font-display text-sm font-bold text-base-bg shadow-glow">
            {editingId ? 'Update Task' : 'Create Task'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY) }} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-ink-muted">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="glass flex items-center justify-between rounded-2xl p-4 shadow-glass">
            <div>
              <p className="font-display text-sm font-semibold text-ink-primary">{t.title}</p>
              <p className="text-xs text-ink-faint">+{t.reward} coins · {t.task_type} · {t.completed ? 'Disabled' : 'Active'}</p>
            </div>
            <div className="flex gap-1">
              <ActionBtn onClick={() => edit(t)}>Edit</ActionBtn>
              <ActionBtn onClick={() => toggleActive(t)}>{t.completed ? 'Enable' : 'Disable'}</ActionBtn>
              <ActionBtn onClick={() => remove(t.id)}>Delete</ActionBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-faint">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10"
      />
    </label>
  )
}

function ActionBtn({ onClick, children }) {
  return (
    <button onClick={onClick} className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink-primary">
      {children}
    </button>
  )
}
