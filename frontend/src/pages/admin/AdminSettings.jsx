import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'

const LABELS = {
  reward_per_tap: 'Reward Per Tap (USDT)',
  energy_per_tap: 'Energy Cost Per Tap',
  energy_regen_amount: 'Energy Regen Amount',
  energy_regen_seconds: 'Energy Regen Interval (sec)',
  max_energy: 'Max Energy',
  energy_cycle_hours: 'Full Energy Reset Cycle (hours)',
  daily_reward_base: 'Daily Reward Base (Coins)',
  daily_reward_streak_bonus: 'Daily Reward Streak Bonus (Coins)',
  coin_to_usdt_rate: 'Coin → USDT Rate',
  referral_reward_inviter: 'Referral Reward — Inviter (USDT)',
  referral_reward_invited: 'Referral Reward — Invited (USDT)',
  max_taps_per_request: 'Max Taps Per Request',
  max_taps_per_second: 'Max Taps Per Second',
}

export default function AdminSettings() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    adminApi.get('/api/admin/settings').then((r) => setSettings(r.data))
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await adminApi.put('/api/admin/settings', { settings })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <p className="text-sm text-ink-muted">Loading…</p>

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-bold text-ink-primary">Mining & Reward Settings</h2>
      <div className="glass grid grid-cols-1 gap-3 rounded-2xl p-4 shadow-glass sm:grid-cols-2">
        {Object.entries(LABELS).map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs text-ink-faint">{label}</span>
            <input
              value={settings[key] ?? ''}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
              className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-ink-primary outline-none ring-1 ring-white/10"
            />
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-xl bg-coin-gradient px-5 py-2.5 font-display text-sm font-bold text-base-bg shadow-glow disabled:opacity-60"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Settings'}
      </button>
    </div>
  )
}
