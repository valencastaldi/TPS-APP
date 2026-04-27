import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '../api/auth'
import { api } from '../api/client'

interface AuthState {
  token: string | null
  username: string | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'poolpay_token'
const USER_KEY = 'poolpay_user'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem(TOKEN_KEY),
    username: localStorage.getItem(USER_KEY),
    loading: true,
  })

  // Al montar, verificar que el token guardado sigue siendo válido
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    authApi
      .me(token)
      .then((data) => {
        setToken(token, data.username)
      })
      .catch(() => {
        clearToken()
      })
      .finally(() => {
        setState((s) => ({ ...s, loading: false }))
      })
  }, [])

  const setToken = (token: string, username: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, username)
    // Inyectar en axios para todas las requests futuras
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setState({ token, username, loading: false })
  }

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    delete api.defaults.headers.common['Authorization']
    setState({ token: null, username: null, loading: false })
  }

  const login = async (username: string, password: string) => {
    const data = await authApi.login(username, password)
    setToken(data.access_token, data.username)
  }

  const logout = () => clearToken()

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
