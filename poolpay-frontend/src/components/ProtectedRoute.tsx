import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, loading } = useAuth()

  if (loading) return <Spinner text="Verificando sesión..." />
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default ProtectedRoute
