import { useEffect, useState } from 'react'
import { invoicesApi } from '../api/invoices'
import { clientsApi } from '../api/clients'
import { paymentsApi } from '../api/payments'
import { Filter, CreditCard, X, CheckCircle } from 'lucide-react'
import type { Invoice, Client, PaymentMethod } from '../types'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' },
  pagado:    { label: 'Pagado',    className: 'bg-emerald-100 text-emerald-800' },
  parcial:   { label: 'Parcial',   className: 'bg-blue-100 text-blue-800' },
  vencido:   { label: 'Vencido',   className: 'bg-red-100 text-red-800' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' }
  return <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${cfg.className}`}>{cfg.label}</span>
}

// ── Modal de pago ────────────────────────────────────────────────────────────
interface PayModalProps {
  invoice: Invoice
  clientName: string
  onClose: () => void
  onSuccess: () => void
}

const PayModal = ({ invoice, clientName, onClose, onSuccess }: PayModalProps) => {
  const [amount, setAmount] = useState(invoice.total.toString())
  const [method, setMethod] = useState<PaymentMethod>('efectivo')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await paymentsApi.create({
        invoice_id: invoice.id,
        method,
        amount: parseFloat(amount),
        notes: notes || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 rounded-lg p-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Registrar Pago</h3>
              <p className="text-sm text-slate-500">
                Factura #{invoice.id} · {clientName} · {invoice.period}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info de la factura */}
          <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm text-slate-500">Total de la factura</span>
            <span className="text-lg font-bold text-slate-800">{ars(invoice.total)}</span>
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Monto a registrar *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={invoice.total}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">
              Podés registrar un pago parcial si el cliente pagó menos del total.
            </p>
          </div>

          {/* Método */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Método de pago *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['efectivo', 'transferencia', 'mercado_pago'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                    method === m
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m === 'efectivo' ? '💵 Efectivo' : m === 'transferencia' ? '🏦 Transferencia' : '📱 MercadoPago'}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Número de transferencia, observaciones..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Confirmar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null)

  useEffect(() => { loadData() }, [statusFilter, periodFilter])

  const loadData = async () => {
    setError(null)
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter) filters.status = statusFilter
      if (periodFilter) filters.period = periodFilter

      const [invData, cliData] = await Promise.all([
        invoicesApi.getAll(filters),
        clientsApi.getAll(),
      ])
      setInvoices(invData)
      setClients(Object.fromEntries(cliData.map((c) => [c.id, c.name])))
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Spinner text="Cargando facturas..." />
  if (error) return <ErrorState message={error} onRetry={loadData} />

  const total = invoices.reduce((s, i) => s + i.total, 0)
  const pendientes = invoices.filter((i) => i.status === 'pendiente').length
  const pagadas = invoices.filter((i) => i.status === 'pagado').length
  const vencidas = invoices.filter((i) => i.status === 'vencido').length

  return (
    <>
      {payingInvoice && (
        <PayModal
          invoice={payingInvoice}
          clientName={clients[payingInvoice.client_id] ?? `Cliente #${payingInvoice.client_id}`}
          onClose={() => setPayingInvoice(null)}
          onSuccess={loadData}
        />
      )}

      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Facturas</h1>
          <p className="text-slate-500 text-sm mt-1">Listado de facturas emitidas</p>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Chip label="Total" value={invoices.length} />
          <Chip label="Pendientes" value={pendientes} valueClass="text-amber-600" />
          <Chip label="Pagadas" value={pagadas} valueClass="text-emerald-600" />
          <Chip label="Vencidas" value={vencidas} valueClass="text-red-600" />
          <Chip label="Importe total" value={ars(total)} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 mb-5">
          <div className="flex items-center gap-4 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="flex flex-wrap gap-4 flex-1">
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="parcial">Parcial</option>
                  <option value="pagado">Pagado</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Período (YYYY-MM)</label>
                <input
                  type="text"
                  placeholder="2025-06"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
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
                  <Th>Cliente</Th>
                  <Th>Período</Th>
                  <Th>Vencimiento</Th>
                  <Th>Total</Th>
                  <Th>Estado</Th>
                  <Th>Acción</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-400">#{inv.id}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">
                      {clients[inv.client_id] ?? `Cliente #${inv.client_id}`}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{inv.period}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(inv.due_date).toLocaleDateString('es-AR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800">
                      {ars(inv.total)}
                      {inv.extras > 0 && (
                        <span className="text-xs font-normal text-slate-400 ml-1">
                          (+{ars(inv.extras)} extras)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5">
                      {inv.status !== 'pagado' && (
                        <button
                          onClick={() => setPayingInvoice(inv)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          Registrar pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {invoices.length === 0 && (
              <div className="text-center py-16 text-slate-400 text-sm">
                No hay facturas que mostrar
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
    {children}
  </th>
)

const Chip = ({
  label, value, valueClass = 'text-slate-800',
}: { label: string; value: string | number; valueClass?: string }) => (
  <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm">
    <span className="text-xs text-slate-500">{label}</span>
    <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
  </div>
)

export default Invoices
