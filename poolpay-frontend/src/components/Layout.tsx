import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, Wallet, TrendingUp, Droplets, LogOut, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { orphanPaymentsApi } from '../api/orphanPayments'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/clients', icon: Users, label: 'Clientes' },
  { path: '/invoices', icon: FileText, label: 'Facturas' },
  { path: '/payments', icon: Wallet, label: 'Pagos' },
  { path: '/orphan-payments', icon: AlertTriangle, label: 'Sin asignar', badge: 'orphans' as const },
  { path: '/billing', icon: TrendingUp, label: 'Facturación' },
]

const Layout = () => {
  const { username, logout } = useAuth()
  const navigate = useNavigate()
  const [orphanCount, setOrphanCount] = useState<number>(0)

  useEffect(() => {
    const loadCount = async () => {
      try {
        const n = await orphanPaymentsApi.pendingCount()
        setOrphanCount(n)
      } catch {
        // silencio en caso de error de auth/red
      }
    }
    loadCount()
    const interval = setInterval(loadCount, 30000)  // refresca cada 30s

    // También refresca al instante cuando la página de huérfanos avisa
    // que se asignó o descartó algo.
    const onChanged = () => { loadCount() }
    window.addEventListener('orphan-payments:changed', onChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('orphan-payments:changed', onChanged)
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500 rounded-lg p-1.5">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-lg leading-none">PoolPay</span>
              <p className="text-slate-400 text-xs mt-0.5">Gestión de Piscinas</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ path, icon: Icon, label, badge }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge === 'orphans' && orphanCount > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                  {orphanCount > 99 ? '99+' : orphanCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold uppercase">
                  {username?.[0] ?? 'A'}
                </span>
              </div>
              <span className="text-slate-300 text-sm truncate">{username ?? 'admin'}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-end">
          <span className="text-sm text-slate-400">
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
        </header>
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
