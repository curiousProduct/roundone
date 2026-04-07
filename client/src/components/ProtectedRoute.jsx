import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  // Early-access users who haven't set a password yet must do so before
  // accessing any protected page.
  if (!user.user_metadata?.password_set) return <Navigate to="/set-password" replace />

  return children
}
