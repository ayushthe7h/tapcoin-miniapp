import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ balance: '', energy: '', total_referrals: '' })

  const load = () => adminApi.get('/api/admin/users', { params: { search: search || undefined } }).then((r) => setUsers(r.data))

  useEffect(() => {
    load()
  }, [search])

  const action = async (id, path) => {
    await adminApi.post(`/api/admin/users/${id}/${path}`)
    load()
  }

  const startEdit = (u) => {
    setEditing(u.id)
    setForm({ balance: u.balance, energy: u.energy, total_referrals: u.total_referrals })
  }

  const saveEdit = async (id) => {
    await adminApi.put(`/api/admin/users/${id}`, {
      balance: Number(form.balance),
      energy: Number(form.energy),
      total_referrals: Number(form.total_referrals),
    })
    setEditing(null)
    load()
  }

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-bold text-ink-primary">Users</h2>
      <input
        placeholder="Search by name or username…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10 focus:ring-violet-glow"
      />

      <div className="glass overflow-x-auto rounded-2xl shadow-glass">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase text-ink-faint">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Coins</th>
              <th className="px-4 py-3">Energy</th>
              <th className="px-4 py-3">Referrals</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 text-ink-primary">
                  {u.first_name} {u.last_name} <span className="text-ink-faint">@{u.username}</span>
                </td>
                {editing === u.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="w-24 rounded-lg bg-white/5 px-2 py-1 text-ink-primary" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={form.energy} onChange={(e) => setForm({ ...form, energy: e.target.value })} className="w-20 rounded-lg bg-white/5 px-2 py-1 text-ink-primary" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={form.total_referrals} onChange={(e) => setForm({ ...form, total_referrals: e.target.value })} className="w-20 rounded-lg bg-white/5 px-2 py-1 text-ink-primary" />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-ink-primary">{Number(u.balance).toFixed(2)} USDT</td>
                    <td className="px-4 py-3 font-mono text-ink-primary">{u.energy}</td>
                    <td className="px-4 py-3 font-mono text-ink-primary">{u.total_referrals}</td>
                  </>
                )}
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.is_banned ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {u.is_banned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {editing === u.id ? (
                      <>
                        <ActionBtn onClick={() => saveEdit(u.id)}>Save</ActionBtn>
                        <ActionBtn onClick={() => setEditing(null)}>Cancel</ActionBtn>
                      </>
                    ) : (
                      <>
                        <ActionBtn onClick={() => startEdit(u)}>Edit</ActionBtn>
                        <ActionBtn onClick={() => action(u.id, u.is_banned ? 'unban' : 'ban')}>
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </ActionBtn>
                        <ActionBtn onClick={() => action(u.id, 'reset-balance')}>Reset Balance</ActionBtn>
                        <ActionBtn onClick={() => action(u.id, 'reset-energy')}>Reset Energy</ActionBtn>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, children }) {
  return (
    <button onClick={onClick} className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink-primary">
      {children}
    </button>
  )
}
