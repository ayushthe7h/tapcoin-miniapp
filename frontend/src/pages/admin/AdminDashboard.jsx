import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import AdminOverview from './AdminOverview'
import AdminUsers from './AdminUsers'
import AdminTasks from './AdminTasks'
import AdminSettings from './AdminSettings'
import AdminBroadcast from './AdminBroadcast'
import AdminLogs from './AdminLogs'

const tabs = [
  { to: '/admin/dashboard/overview', label: 'Overview' },
  { to: '/admin/dashboard/users', label: 'Users' },
  { to: '/admin/dashboard/tasks', label: 'Tasks' },
  { to: '/admin/dashboard/settings', label: 'Settings' },
  { to: '/admin/dashboard/broadcast', label: 'Broadcast' },
  { to: '/admin/dashboard/logs', label: 'Logs' },
]

export default function AdminDashboard() {
  const navigate = useNavigate()

  const logout = () => {
    localStorage.removeItem('tapcoin_admin_token')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <header className="glass sticky top-0 z-10 flex items-center justify-between px-6 py-4">
        <h1 className="font-display text-lg font-bold text-ink-primary">TapCoin Admin</h1>
        <button onClick={logout} className="rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink-muted">
          Log out
        </button>
      </header>

      <nav className="mx-auto flex max-w-5xl flex-wrap gap-2 px-6 py-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `rounded-xl px-4 py-2 text-sm font-medium ${
                isActive ? 'bg-violet-glow/20 text-violet-glow' : 'bg-white/5 text-ink-muted'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="broadcast" element={<AdminBroadcast />} />
          <Route path="logs" element={<AdminLogs />} />
        </Routes>
      </main>
    </div>
  )
}
