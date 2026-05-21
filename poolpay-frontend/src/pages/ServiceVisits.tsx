import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, MessageCircle, ExternalLink, Copy, CheckCircle2, Clock, XCircle, PhoneOff, Trash2 } from 'lucide-react'
import { serviceVisitsApi, type ServiceVisitOut } from '../api/serviceVisits'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

type WaStatus = ServiceVisitOut['whatsapp_status']

const waBadge = (status: WaStatus) => {
  switch (status) {
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Enviado
        </span>
      )
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3" /> Pendiente
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3" /> Fallido
        </span>
      )
    case 'no_phone':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          <PhoneOff className="w-3 h-3" /> Sin teléfono
        </span>
      )
  }
}

const ServiceVisits = () => {
  const [visits, setVisits] = useState<ServiceVisitOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await serviceVisitsApi.list()
      setVisits(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Error cargando visitas')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (visit: ServiceVisitOut) => {
    setActioningId(visit.id)
    try {
      const result = await serviceVisitsApi.resendWhatsapp(visit.id)
      if (result.wame_url) {
        window.open(result.wame_url, '_blank', 'noopener,noreferrer')
      }
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al reenviar WhatsApp')
    } finally {
      setActioningId(null)
    }
  }

  const handleDelete = async (visit: ServiceVisitOut) => {
    if (!window.confirm(`¿Borrar la visita de ${visit.client_name}? También se eliminará su factura.`)) return
    setDeletingId(visit.id)
    try {
      await serviceVisitsApi.remove(visit.id)
      setVisits((prev) => prev.filter((x) => x.id !== visit.id))
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al borrar la visita')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopyWame = async (visit: ServiceVisitOut) => {
    if (!visit.payment_link_url) return
    try {
      const result = await serviceVisitsApi.resendWhatsapp(visit.id)
      if (result.wame_url) {
        await navigator.clipboard.writeText(result.wame_url)
        setCopiedId(visit.id)
        setTimeout(() => setCopiedId(null), 2000)
      }
    } catch {
      // silencio
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-800">Visitas de Servicio</h1>
          <span className="ml-2 bg-slate-200 text-slate-600 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {visits.length}
          </span>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {visits.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No hay visitas registradas todavía.</p>
          <p className="text-slate-400 text-xs mt-1">
            Aparecerán cuando los pileteros comiencen a registrar limpiezas desde la app.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Piletero</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Productos</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Monto</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">WhatsApp</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Factura</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    {/* Fecha */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDateTime(v.visited_at)}
                      {v.duration_minutes && (
                        <span className="block text-xs text-slate-400">{v.duration_minutes} min</span>
                      )}
                    </td>

                    {/* Cliente */}
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {v.client_name}
                      {v.notes && (
                        <span
                          className="block text-xs text-slate-400 max-w-[180px] truncate"
                          title={v.notes}
                        >
                          {v.notes}
                        </span>
                      )}
                    </td>

                    {/* Piletero */}
                    <td className="px-4 py-3 text-slate-600">
                      {v.piletero_name ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* Productos */}
                    <td className="px-4 py-3 text-slate-500 max-w-[160px]">
                      {v.products_used ? (
                        <span className="truncate block" title={v.products_used}>
                          {v.products_used}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Monto */}
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {ars(v.price)}
                    </td>

                    {/* WhatsApp status */}
                    <td className="px-4 py-3">
                      {v.paid_cash ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Pagado en efectivo
                        </span>
                      ) : (
                        waBadge(v.whatsapp_status)
                      )}
                      {v.whatsapp_error && (
                        <span
                          className="block text-xs text-red-400 mt-0.5 max-w-[140px] truncate"
                          title={v.whatsapp_error}
                        >
                          {v.whatsapp_error}
                        </span>
                      )}
                    </td>

                    {/* Factura */}
                    <td className="px-4 py-3">
                      {v.invoice_id ? (
                        <span className="text-slate-600">#{v.invoice_id}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Abrir payment link */}
                        {v.payment_link_url && (
                          <a
                            href={v.payment_link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir link de pago"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        {/* Abrir WhatsApp (wame_url directo en pending) */}
                        {v.whatsapp_status === 'pending' && v.payment_link_url && (
                          <button
                            onClick={() => handleResend(v)}
                            disabled={actioningId === v.id}
                            title="Abrir WhatsApp con mensaje pre-armado"
                            className="p-1.5 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                          >
                            {actioningId === v.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <MessageCircle className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Copiar wa.me URL */}
                        {v.whatsapp_status === 'pending' && v.payment_link_url && (
                          <button
                            onClick={() => handleCopyWame(v)}
                            disabled={actioningId === v.id}
                            title="Copiar URL de WhatsApp"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                          >
                            {copiedId === v.id ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        {/* Reenviar si falló */}
                        {v.whatsapp_status === 'failed' && v.payment_link_url && (
                          <button
                            onClick={() => handleResend(v)}
                            disabled={actioningId === v.id}
                            title="Reintentar WhatsApp"
                            className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {actioningId === v.id ? 'Enviando…' : 'Reintentar'}
                          </button>
                        )}

                        {/* Borrar visita */}
                        <button
                          onClick={() => handleDelete(v)}
                          disabled={deletingId === v.id}
                          title="Borrar visita y su factura"
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          {deletingId === v.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServiceVisits
