import { useEffect, useState } from 'react'
import { AlertTriangle, Check, X, ChevronDown, ChevronUp, Users, Calendar, DollarSign, RefreshCw } from 'lucide-react'
import { orphanPaymentsApi } from '../api/orphanPayments'
import type { OrphanPaymentDetail, OrphanPaymentSummary } from '../api/orphanPayments'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'
import ConfirmModal from '../components/ConfirmModal'

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

const scoreColor = (score: number) => {
  if (score >= 0.85) return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (score >= 0.6) return 'bg-amber-100 text-amber-800 border-amber-300'
  if (score >= 0.3) return 'bg-slate-100 text-slate-700 border-slate-300'
  return 'bg-red-100 text-red-800 border-red-300'
}

const scoreLabel = (score: number) => {
  if (score >= 0.85) return 'Muy probable'
  if (score >= 0.6) return 'Probable'
  if (score >= 0.3) return 'Poco probable'
  return 'Improbable'
}

const OrphanPayments = () => {
  const [orphans, setOrphans] = useState<OrphanPaymentSummary[]>([])
  const [expandedDetails, setExpandedDetails] = useState<Record<number, OrphanPaymentDetail>>({})
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'pending_review' | 'assigned' | 'discarded' | 'all'>('pending_review')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<number | null>(null)

  // Estado de los modales de confirmación
  const [assignModal, setAssignModal] = useState<{ orphanId: number; invoiceId: number; clientName: string; amount: number } | null>(null)
  const [discardModal, setDiscardModal] = useState<{ orphanId: number; amount: number } | null>(null)

  useEffect(() => {
    load()
  }, [filter])

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await orphanPaymentsApi.list(filter)
      setOrphans(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Error cargando pagos huérfanos')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = async (orphanId: number) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(orphanId)) {
      newSet.delete(orphanId)
      setExpandedIds(newSet)
      return
    }
    newSet.add(orphanId)
    setExpandedIds(newSet)
    if (!expandedDetails[orphanId]) {
      try {
        const detail = await orphanPaymentsApi.get(orphanId)
        setExpandedDetails({ ...expandedDetails, [orphanId]: detail })
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? e.message)
      }
    }
  }

  // Saca un huérfano del listado inmediatamente sin esperar al reload.
  // También limpia su detalle expandido y avisa a la app que el contador del
  // sidebar tiene que refrescarse.
  const removeOrphanLocally = (orphanId: number) => {
    setOrphans(prev => prev.filter(o => o.id !== orphanId))
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.delete(orphanId)
      return next
    })
    setExpandedDetails(prev => {
      const { [orphanId]: _omit, ...rest } = prev
      return rest
    })
    // El sidebar escucha este evento y refresca el badge en el momento.
    window.dispatchEvent(new CustomEvent('orphan-payments:changed'))
  }

  // Abre el modal de confirmación de asignación
  const handleAssign = (orphanId: number, invoiceId: number, clientName: string, amount: number) => {
    setAssignModal({ orphanId, invoiceId, clientName, amount })
  }

  // Abre el modal de descarte
  const handleDiscard = (orphanId: number, amount: number) => {
    setDiscardModal({ orphanId, amount })
  }

  // Ejecuta la asignación confirmada
  const confirmAssign = async () => {
    if (!assignModal) return
    const { orphanId, invoiceId } = assignModal
    setActioningId(orphanId)
    try {
      await orphanPaymentsApi.assign(orphanId, invoiceId)
      if (filter === 'pending_review') removeOrphanLocally(orphanId)
      else await load()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message)
    } finally {
      setActioningId(null)
      setAssignModal(null)
    }
  }

  // Ejecuta el descarte confirmado
  const confirmDiscard = async (reason?: string) => {
    if (!discardModal) return
    const { orphanId } = discardModal
    setActioningId(orphanId)
    try {
      await orphanPaymentsApi.discard(orphanId, reason || undefined)
      if (filter === 'pending_review') removeOrphanLocally(orphanId)
      else await load()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message)
    } finally {
      setActioningId(null)
      setDiscardModal(null)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  const counts = {
    pending_review: orphans.filter(o => o.status === 'pending_review').length,
    assigned: orphans.filter(o => o.status === 'assigned').length,
    discarded: orphans.filter(o => o.status === 'discarded').length,
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
            Pagos sin asignar
          </h1>
          <p className="text-slate-600 mt-1">
            Transferencias al CBU que llegaron sin link. Asignalas a la factura correspondiente.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Recargar
        </button>
      </div>

      {/* Filtros tipo tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'pending_review' as const, label: 'Pendientes', count: counts.pending_review },
          { key: 'assigned' as const, label: 'Asignados', count: counts.assigned },
          { key: 'discarded' as const, label: 'Descartados', count: counts.discarded },
          { key: 'all' as const, label: 'Todos' },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
            {count !== undefined && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                filter === key ? 'bg-blue-700' : 'bg-slate-200'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {orphans.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">
            {filter === 'pending_review' ? '¡Sin pagos pendientes de revisión!' : 'Nada que mostrar'}
          </h3>
          <p className="text-slate-600 mt-1">
            {filter === 'pending_review'
              ? 'Todas las transferencias se asignaron automáticamente o las resolviste manualmente.'
              : 'Probá con otro filtro.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {orphans.map(o => {
          const isExpanded = expandedIds.has(o.id)
          const detail = expandedDetails[o.id]
          return (
            <div key={o.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {/* Header de cada huérfano */}
              <button
                onClick={() => toggleExpand(o.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 text-left"
              >
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <div className="bg-amber-100 rounded-lg p-2">
                      <DollarSign className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg font-semibold text-slate-900">{ars(o.amount)}</span>
                      {o.payer_name && (
                        <span className="text-sm text-slate-600 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {o.payer_name}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateTime(o.paid_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">MP #{o.mp_payment_id}</span>
                      {o.payment_type && <span className="text-slate-400">·</span>}
                      {o.payment_type && <span className="text-slate-500">{o.payment_type}</span>}
                      {o.top_candidate_score !== null && o.status === 'pending_review' && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${scoreColor(o.top_candidate_score)}`}>
                            Sugerido: {o.top_candidate_client} ({Math.round(o.top_candidate_score * 100)}%)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {o.status !== 'pending_review' && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      o.status === 'assigned' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {o.status === 'assigned' ? 'Asignado' : 'Descartado'}
                    </span>
                  )}
                </div>
                {isExpanded
                  ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                }
              </button>

              {/* Cuerpo expandido: candidatos */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  {!detail ? (
                    <Spinner />
                  ) : detail.candidates.length === 0 ? (
                    o.status === 'pending_review' ? (
                      <div className="text-center py-4">
                        <p className="text-slate-600 text-sm">No se encontraron facturas candidatas con un monto similar.</p>
                        <p className="text-slate-500 text-xs mt-1">
                          Si esto era un pago de prueba o no era para este sistema, podés descartarlo.
                        </p>
                        <button
                          onClick={() => handleDiscard(o.id, o.amount)}
                          disabled={actioningId === o.id}
                          className="mt-3 px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm"
                        >
                          Descartar este huérfano
                        </button>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm text-center">Este huérfano ya fue resuelto.</p>
                    )
                  ) : (
                    <>
                      <p className="text-xs font-medium text-slate-700 uppercase mb-3">
                        Candidatos sugeridos (rankeados por probabilidad)
                      </p>
                      <div className="space-y-2">
                        {detail.candidates.map(c => (
                          <div key={c.invoice_id} className="bg-white rounded-lg border border-slate-200 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="font-semibold text-slate-900">{c.client_name}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${scoreColor(c.score)}`}>
                                    {scoreLabel(c.score)} · {Math.round(c.score * 100)}%
                                  </span>
                                </div>
                                <div className="text-sm text-slate-600 mb-2">
                                  Factura #{c.invoice_id} · Período {c.period} · Total {ars(c.total)}
                                  {c.pending_amount !== c.total && (
                                    <span className="ml-2 text-amber-700">
                                      (Pendiente: {ars(c.pending_amount)})
                                    </span>
                                  )}
                                </div>
                                <ul className="text-xs text-slate-500 space-y-0.5">
                                  {c.reasons.map((r, i) => (
                                    <li key={i}>· {r}</li>
                                  ))}
                                </ul>
                              </div>
                              {o.status === 'pending_review' && (
                                <button
                                  onClick={() => handleAssign(o.id, c.invoice_id, c.client_name, o.amount)}
                                  disabled={actioningId === o.id}
                                  className="flex-shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                  <Check className="w-4 h-4" />
                                  Asignar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {o.status === 'pending_review' && (
                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                          <button
                            onClick={() => handleDiscard(o.id, o.amount)}
                            disabled={actioningId === o.id}
                            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-sm flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Ninguno corresponde — descartar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Modales de confirmación ────────────────────────────── */}
      <ConfirmModal
        open={!!assignModal}
        title="Confirmar asignación"
        variant="success"
        confirmLabel="Asignar pago"
        description={assignModal && (
          <>
            Vas a asignar el pago de <span className="font-semibold text-slate-900">{ars(assignModal.amount)}</span> a la factura de{' '}
            <span className="font-semibold text-slate-900">{assignModal.clientName}</span>.
            <br />
            <span className="text-xs text-slate-500 mt-2 block">
              Esta acción crea un Payment real y marca la factura como pagada (o parcial si el monto no cubre el total).
            </span>
          </>
        )}
        onConfirm={confirmAssign}
        onCancel={() => setAssignModal(null)}
      />

      <ConfirmModal
        open={!!discardModal}
        title="Descartar pago huérfano"
        variant="danger"
        confirmLabel="Descartar"
        inputLabel="Motivo del descarte (opcional)"
        inputPlaceholder="Ej: pago de prueba, no era para nosotros..."
        description={discardModal && (
          <>
            Vas a descartar el huérfano de <span className="font-semibold text-slate-900">{ars(discardModal.amount)}</span>.
            <br />
            <span className="text-xs text-slate-500 mt-2 block">
              No se va a crear ningún Payment. El registro queda en la pestaña "Descartados" por si después querés revisarlo.
            </span>
          </>
        )}
        onConfirm={(reason) => confirmDiscard(reason)}
        onCancel={() => setDiscardModal(null)}
      />
    </div>
  )
}

export default OrphanPayments
