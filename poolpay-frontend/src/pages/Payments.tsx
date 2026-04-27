import { useEffect, useState } from 'react'
import { paymentsApi } from '../api/payments'
import { invoicesApi } from '../api/invoices'
import { clientsApi } from '../api/clients'
import { Wallet, Banknote, Smartphone } from 'lucide-react'
import type { Payment } from '../types'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const METHOD_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  efectivo:      { label: 'Efectivo',      className: 'bg-emerald-100 text-emerald-800', icon: Banknote },
  transferencia: { label: 'Transferencia', className: 'bg-blue-100 text-blue-800',       icon: Wallet },
  mercado_pago:  { label: 'MercadoPago',   className: 'bg-violet-100 text-violet-800',   icon: Smartphone },
}

const MethodBadge = ({ method }: { method: string }) => {
  const cfg = METHOD_CONFIG[method] ?? { label: method, className: 'bg-slate-100 text-slate-700', icon: Wallet }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([])
  const [clientByInvoice, setClientByInvoice] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadPayments() }, [])

  const loadPayments = async () => {
    setError(null)
    setLoading(true)
    try {
      const [payData, invData, cliData] = await Promise.all([
        paymentsApi.getAll(),
        invoicesApi.getAll(),
        clientsApi.getAll(),
      ])
      setPayments(payData)
      const clientById = Object.fromEntries(cliData.map((c) => [c.id, c.name]))
      const map: Record<number, string> = {}
      for (const inv of invData) {
        map[inv.id] = clientById[inv.client_id] ?? `Cliente #${inv.client_id}`
      }
      setClientByInvoice(map)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error al cargar pagos')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Spinner text="Cargando pagos..." />
  if (error) return <ErrorState message={error} onRetry={loadPayments} />

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const byMethod = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + p.amount
    return acc
  }, {})

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Pagos</h1>
        <p className="text-slate-500 text-sm mt-1">Historial de cobros registrados</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total pagos</p>
          <p className="text-3xl font-bold text-slate-800">{payments.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Monto total</p>
          <p className="text-3xl font-bold text-emerald-600">{ars(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Por método</p>
          <div className="space-y-1.5">
            {Object.entries(byMethod).map(([method, amount]) => (
              <div key={method} className="flex justify-between text-sm">
                <MethodBadge method={method} />
                <span className="font-medium text-slate-700">{ars(amount)}</span>
              </div>
            ))}
            {Object.keys(byMethod).length === 0 && (
              <p className="text-sm text-slate-400">Sin datos</p>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50">
                <Th>ID</Th>
                <Th>Factura</Th>
                <Th>Fecha</Th>
                <Th>Método</Th>
                <Th>Monto</Th>
                <Th>Notas</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-slate-400">#{p.id}</td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-slate-800">{clientByInvoice[p.invoice_id] ?? '—'}</p>
                    <p className="text-xs text-slate-400">Factura #{p.invoice_id}</p>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                    {new Date(p.paid_at).toLocaleDateString('es-AR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3.5"><MethodBadge method={p.method} /></td>
                  <td className="px-5 py-3.5 text-sm font-bold text-emerald-600">{ars(p.amount)}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-400 max-w-xs truncate">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {payments.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">
              No hay pagos registrados
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
    {children}
  </th>
)

export default Payments
