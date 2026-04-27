import { useEffect, useState } from 'react'
import { billingApi } from '../api/billing'
import { Users, FileText, Wallet, TrendingUp } from 'lucide-react'
import type { GeneralStats } from '../types'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const StatCard = ({
  title,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent: string
}) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className={`h-1 ${accent}`} />
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${accent} bg-opacity-10`}>
          <Icon className="w-5 h-5 text-slate-600" />
        </div>
      </div>
    </div>
  </div>
)

const Dashboard = () => {
  const [stats, setStats] = useState<GeneralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await billingApi.getStats()
      setStats(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Spinner text="Cargando dashboard..." />
  if (error) return <ErrorState message={error} onRetry={loadStats} />
  if (!stats) return null

  const collectionRate =
    stats.total_billed > 0 ? Math.round((stats.total_collected / stats.total_billed) * 100) : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen general del negocio</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard
          title="Clientes Activos"
          value={stats.active_clients}
          sub={`${stats.inactive_clients} inactivos · ${stats.total_clients} total`}
          icon={Users}
          accent="bg-blue-500"
        />
        <StatCard
          title="Facturas Emitidas"
          value={stats.total_invoices}
          icon={FileText}
          accent="bg-violet-500"
        />
        <StatCard
          title="Total Facturado"
          value={ars(stats.total_billed)}
          icon={TrendingUp}
          accent="bg-emerald-500"
        />
        <StatCard
          title="Pendiente de Cobro"
          value={ars(stats.pending_collection)}
          sub={`${stats.total_payments} pagos registrados`}
          icon={Wallet}
          accent="bg-amber-500"
        />
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Clientes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Clientes
          </h2>
          <div className="space-y-3">
            <Row label="Total" value={stats.total_clients} />
            <Row label="Activos" value={stats.active_clients} valueClass="text-emerald-600 font-semibold" />
            <Row label="Inactivos" value={stats.inactive_clients} valueClass="text-slate-400" />
          </div>
        </div>

        {/* Financiero */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Financiero
          </h2>
          <div className="space-y-3">
            <Row label="Total facturado" value={ars(stats.total_billed)} />
            <Row label="Cobrado" value={ars(stats.total_collected)} valueClass="text-emerald-600 font-semibold" />
            <Row label="Pendiente" value={ars(stats.pending_collection)} valueClass="text-amber-600 font-semibold" />
          </div>

          {/* Barra de cobro */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Tasa de cobro</span>
              <span className="font-semibold text-slate-700">{collectionRate}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Row = ({
  label,
  value,
  valueClass = 'text-slate-800',
}: {
  label: string
  value: string | number
  valueClass?: string
}) => (
  <div className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
    <span className="text-sm text-slate-500">{label}</span>
    <span className={`text-sm ${valueClass}`}>{value}</span>
  </div>
)

export default Dashboard
