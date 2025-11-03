import { useEffect, useState } from 'react'
import { billingApi } from '../api/billing'
import { Users, FileText, Wallet, TrendingUp } from 'lucide-react'
import type { GeneralStats } from '../types'

const Dashboard = () => {
  const [stats, setStats] = useState<GeneralStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await billingApi.getStats()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Cargando...</div>
  }

  if (!stats) {
    return <div className="text-center py-12">Error al cargar estadísticas</div>
  }

  const cards = [
    {
      title: 'Clientes Activos',
      value: stats.active_clients,
      total: stats.total_clients,
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Facturas',
      value: stats.total_invoices,
      icon: FileText,
      color: 'purple',
    },
    {
      title: 'Total Facturado',
      value: `$${stats.total_billed.toFixed(2)}`,
      icon: TrendingUp,
      color: 'green',
    },
    {
      title: 'Pendiente de Cobro',
      value: `$${stats.pending_collection.toFixed(2)}`,
      icon: Wallet,
      color: 'orange',
    },
  ]

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <card.icon className={`w-8 h-8 text-${card.color}-500`} />
              {card.total && (
                <span className="text-sm text-gray-500">
                  de {card.total}
                </span>
              )}
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">
              {card.title}
            </h3>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Resumen de Clientes
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total de clientes:</span>
              <span className="font-semibold">{stats.total_clients}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Activos:</span>
              <span className="font-semibold text-green-600">
                {stats.active_clients}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Inactivos:</span>
              <span className="font-semibold text-gray-400">
                {stats.inactive_clients}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Resumen Financiero
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total facturado:</span>
              <span className="font-semibold">
                ${stats.total_billed.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total cobrado:</span>
              <span className="font-semibold text-green-600">
                ${stats.total_collected.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pendiente:</span>
              <span className="font-semibold text-orange-600">
                ${stats.pending_collection.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-gray-600">Total de pagos:</span>
              <span>{stats.total_payments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

