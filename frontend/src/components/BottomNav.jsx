import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

const items = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/tasks', label: 'Tasks', icon: TasksIcon },
  { to: '/tap', label: 'Tap', icon: TapIcon, center: true },
  { to: '/referral', label: 'Invite', icon: ReferralIcon },
  { to: '/wallet', label: 'Wallet', icon: WalletIcon },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3">
      <div className="glass mx-auto flex max-w-md items-center justify-between rounded-3xl px-2 py-2 shadow-glass">
        {items.map(({ to, label, icon: Icon, center }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-colors ${
                center ? '-mt-6' : ''
              }`
            }
          >
            {({ isActive }) => (
              <>
                {center ? (
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex h-14 w-14 items-center justify-center rounded-full bg-coin-gradient shadow-glow ${
                      isActive ? 'ring-2 ring-amber-glow/60' : ''
                    }`}
                  >
                    <Icon active />
                  </motion.div>
                ) : (
                  <Icon active={isActive} />
                )}
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? 'text-amber-glow' : 'text-ink-faint'
                  } ${center ? 'mt-1' : ''}`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function iconColor(active) {
  return active ? '#FFB020' : '#5B6080'
}

function HomeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2">
      <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function TasksIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function TapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0C16" strokeWidth="2.2">
      <path d="M9 11.5V6a2 2 0 114 0v4M13 6a2 2 0 114 0v6M17 8.5a2 2 0 114 0V13a7 7 0 01-7 7h-1a7 7 0 01-6-3.4l-2.2-3.7a1.8 1.8 0 013-1.9L9 13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ReferralIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0112 0" strokeLinecap="round" />
      <path d="M16 4.5a3 3 0 010 6M21 20a6 6 0 00-5-5.9" strokeLinecap="round" />
    </svg>
  )
}
function WalletIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor(active)} strokeWidth="2">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14" r="1.3" fill={iconColor(active)} stroke="none" />
    </svg>
  )
}
