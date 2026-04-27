import { useState } from 'react'
import { billingApi } from '../api/billing'
import { Calendar, Send, AlertCircle, Download } from 'lucide-react'
import type { BillingGenerate } from '../types'

const Billing = () => {
  const [period, setPeriod] = useState('')
  const [dueDay, setDueDay] = useState(10)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data: BillingGenerate = {
        period,
        due_day: dueDay,
      }
      const response = await billingApi.generate(data)
      setResult(response)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al generar facturas')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!period) return
    setExporting(true)
    try {
      await billingApi.exportExcel(period)
    } catch {
      setError('No hay facturas para ese período o error al exportar.')
    } finally {
      setExporting(false)
    }
  }

  // Obtener período actual (YYYY-MM)
  const getCurrentPeriod = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        Generación de Facturas
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Generar Facturas del Período
          </h3>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Período (YYYY-MM) *
              </label>
              <input
                type="text"
                placeholder="2025-01"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                pattern="\d{4}-\d{2}"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Período actual: {getCurrentPeriod()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Día de Vencimiento
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Las facturas vencerán el día {dueDay} del mes
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Generando...' : 'Generar Facturas'}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || !period}
                title="Descargar Excel del período"
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-emerald-300 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Exportando...' : 'Excel'}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                ℹ️ Información
              </h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Se generarán facturas para todos los clientes activos</li>
                <li>• No se crearán duplicados si ya existen facturas del período</li>
                <li>• El monto de cada factura será el precio del cliente</li>
              </ul>
            </div>
          </form>
        </div>

        {/* Result */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Resultado
          </h3>

          {!result && !error && (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Completa el formulario para generar facturas</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-900 mb-1">Error</h4>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-900 mb-3">
                  ✅ Facturas generadas exitosamente
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Período:</span>
                    <span className="font-medium text-green-900">
                      {result.period}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Creadas:</span>
                    <span className="font-medium text-green-900">
                      {result.created}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Omitidas (ya existían):</span>
                    <span className="font-medium text-green-900">
                      {result.skipped}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">Total clientes activos:</span>
                    <span className="font-medium text-green-900">
                      {result.total_clients}
                    </span>
                  </div>
                </div>
              </div>

              {result.created === 0 && result.skipped > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ℹ️ Ya existen facturas para este período. No se crearon nuevas
                    facturas.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setPeriod(getCurrentPeriod())}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            📅 Usar período actual
          </button>
          <button
            onClick={() => {
              const now = new Date()
              now.setMonth(now.getMonth() + 1)
              const year = now.getFullYear()
              const month = String(now.getMonth() + 1).padStart(2, '0')
              setPeriod(`${year}-${month}`)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            ⏭️ Próximo mes
          </button>
          <button
            onClick={() => {
              setPeriod('')
              setDueDay(10)
              setResult(null)
              setError('')
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            🔄 Limpiar formulario
          </button>
        </div>
      </div>
    </div>
  )
}

export default Billing

