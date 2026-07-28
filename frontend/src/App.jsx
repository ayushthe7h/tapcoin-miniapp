import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { FullPageLoader } from './components/Loader'
import BottomNav from './components/BottomNav'
import RequireAdmin from './components/RequireAdmin'

import Home from './pages/Home'
import Tap from './pages/Tap'
import Tasks from './pages/Tasks'
import Referral from './pages/Referral'
import Wallet from './pages/Wallet'
import Withdraw from './pages/Withdraw'

import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function MiniApp() {
  const { loading, error } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader label="Connecting to Telegram…" />

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-app-gradient px-6 text-center">
        <p className="font-display text-lg font-bold text-ink-primary">Open in Telegram</p>
        <p className="text-sm text-ink-muted">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/tap" element={<PageTransition><Tap /></PageTransition>} />
          <Route path="/tasks" element={<PageTransition><Tasks /></PageTransition>} />
          <Route path="/referral" element={<PageTransition><Referral /></PageTransition>} />
          <Route path="/wallet" element={<PageTransition><Wallet /></PageTransition>} />
          <Route path="/withdraw" element={<PageTransition><Withdraw /></PageTransition>} />
        </Routes>
      </AnimatePresence>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard/*"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <MiniApp />
            </AuthProvider>
          }
        />
      </Routes>
    </ToastProvider>
  )
}
