import { Navigate } from 'react-router-dom'

export default function RequireAdmin({ children }) {
  const token = localStorage.getItem('tapcoin_admin_token')
  if (!token) return <Navigate to="/admin/login" replace />
  return children
}
