import { useEffect, useState } from 'react'
import { adminApi } from '../../api/client'

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Gas Fee Approved' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
]

export default function AdminWithdrawals() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')
  const [rejecting, setRejecting] = useState(null) // { id, action: 'gas-fee'|'withdrawal' }
  const [notes, setNotes] = useState('')

  const load = () => {
    adminApi
      .get('/api/admin/withdrawals', { params: filter ? { status: filter } : {} })
      .then((r) => setRows(r.data))
  }

  useEffect(load, [filter])

  const act = async (id, action, body) => {
    try {
      await adminApi.post(`/api/admin/withdrawals/${id}/${action}`, body || {})
      load()
    } catch (e) {
      alert(e?.response?.data?.detail || 'Action failed')
    }
  }

  const submitReject = async () => {
    if (!rejecting) return
    await act(rejecting.id, rejecting.action === 'gas-fee' ? 'reject-gas-fee' : 'reject-withdrawal', { admin_notes: notes })
    setRejecting(null)
    setNotes('')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
              filter === f.id ? 'bg-violet-glow/20 text-violet-glow' : 'bg-white/5 text-ink-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-ink-faint">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3">Gas Fee Txn</th>
              <th className="px-4 py-3">Gas Fee</th>
              <th className="px-4 py-3">Withdrawal</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows === null ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-ink-muted">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-ink-muted">No withdrawal requests</td></tr>
            ) : (
              rows.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-3">
                    <p className="text-ink-primary">{w.first_name || w.username || 'User'}</p>
                    <p className="text-xs text-ink-faint">@{w.username || '—'} · ID {w.telegram_id}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink-primary">{Number(w.amount).toFixed(2)} USDT</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-ink-faint">{w.wallet_type}</p>
                    <p className="max-w-[160px] truncate font-mono text-xs text-ink-primary">{w.wallet_address}</p>
                  </td>
                  <td className="px-4 py-3 max-w-[140px] truncate font-mono text-xs text-ink-primary">{w.gas_fee_txn_id}</td>
                  <td className="px-4 py-3"><Badge status={w.gas_fee_status} /></td>
                  <td className="px-4 py-3"><Badge status={w.withdrawal_status} /></td>
                  <td className="px-4 py-3 text-xs text-ink-faint">{new Date(w.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {w.gas_fee_status === 'pending' && (
                        <>
                          <ActionBtn onClick={() => act(w.id, 'approve-gas-fee')}>Approve Gas Fee</ActionBtn>
                          <ActionBtn danger onClick={() => setRejecting({ id: w.id, action: 'gas-fee' })}>Reject Gas Fee</ActionBtn>
                        </>
                      )}
                      {w.gas_fee_status === 'approved' && w.withdrawal_status === 'pending' && (
                        <>
                          <ActionBtn onClick={() => act(w.id, 'approve-withdrawal')}>Approve Withdrawal</ActionBtn>
                          <ActionBtn danger onClick={() => setRejecting({ id: w.id, action: 'withdrawal' })}>Reject Withdrawal</ActionBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRejecting(null)}>
          <div className="glass w-full max-w-sm rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-sm font-bold text-ink-primary">Rejection reason (optional)</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mb-4 w-full rounded-xl bg-white/5 p-3 text-sm text-ink-primary focus:outline-none"
              placeholder="Reason shown to the user..."
            />
            <div className="flex gap-2">
              <button onClick={() => setRejecting(null)} className="flex-1 rounded-xl bg-white/5 py-2 text-xs font-semibold text-ink-muted">Cancel</button>
              <button onClick={submitReject} className="flex-1 rounded-xl bg-red-500/20 py-2 text-xs font-semibold text-red-400">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Badge({ status }) {
  const map = {
    pending: 'bg-white/10 text-ink-faint',
    approved: 'bg-amber-glow/15 text-amber-glow',
    completed: 'bg-emerald-500/15 text-emerald-400',
    rejected: 'bg-red-500/15 text-red-400',
  }
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${map[status] || map.pending}`}>{status}</span>
}

function ActionBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${danger ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-ink-primary'}`}
    >
      {children}
    </button>
  )
}
