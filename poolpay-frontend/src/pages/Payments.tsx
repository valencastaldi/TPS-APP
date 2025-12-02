import { useEffect, useState } from 'react'
import { paymentsApi } from '../api/payments'
import { Wallet, DollarSign } from 'lucide-react'
import type { Payment } from '../types'

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [])

  const loadPayments = async () => {
    try {
      const data = await paymentsApi.getAll()
      setPayments(data)
    } catch (error) {
      console.error('Error loading payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMethodBadge = (method: string) => {
    const styles = {
      efectivo: 'bg-green-100 text-green-800',
      transferencia: 'bg-blue-100 text-blue-800',
      mercado_pago: 'bg-purple-100 text-purple-800',
    }
    const labels = {
      efectivo: '💵 Efectivo',
      transferencia: '🏦 Transferencia',
      mercado_pago: '🤖 MercadoPago (Auto)',
    }
    return {
      style: styles[method as keyof typeof styles] || 'bg-gray-100 text-gray-800',
      label: labels[method as keyof typeof labels] || method,
    }
  }

  if (loading) {
    return <div className="text-center py-12">Cargando pagos...</div>
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Pagos</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Pagos</p>
              <p className="text-2xl font-bold text-gray-800">{payments.length}</p>
            </div>
            <Wallet className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Monto Total</p>
              <p className="text-2xl font-bold text-green-600">
                ${totalAmount.toFixed(2)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Promedio</p>
              <p className="text-2xl font-bold text-gray-800">
                ${payments.length > 0 ? (totalAmount / payments.length).toFixed(2) : '0.00'}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Factura
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Método
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notas
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">
                    #{payment.id}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    Factura #{payment.invoice_id}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(payment.paid_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      getMethodBadge(payment.method).style
                    }`}
                  >
                    {getMethodBadge(payment.method).label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-bold text-green-600">
                    ${payment.amount.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-500">
                    {payment.notes || '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {payments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay pagos registrados
          </div>
        )}
      </div>
    </div>
  )
}

export default Payments

