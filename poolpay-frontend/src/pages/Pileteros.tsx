import { useEffect, useState } from 'react'
import { UserCog, Plus, Copy, Eye, EyeOff, RefreshCw, CheckCircle2, UserX, UserCheck } from 'lucide-react'
import { pileterosApi, type PileteroOut } from '../api/pileteros'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'
import ConfirmModal from '../components/ConfirmModal'

const obfuscate = (key: string) =>
  key.length > 8 ? `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}` : '••••••••'

const Pileteros = () => {
  const [pileteros, setPileteros] = useState<PileteroOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set())
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [actioningId, setActioningId] = useState<number | null>(null)

  // Modal nuevo piletero
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Modal confirmar regenerar key
  const [regenModal, setRegenModal] = useState<PileteroOut | null>(null)
  // Modal confirmar desactivar
  const [deactivateModal, setDeactivateModal] = useState<PileteroOut | null>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setPileteros(await pileterosApi.list())
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Error cargando pileteros')
    } finally {
      setLoading(false)
    }
  }

  const toggleReveal = (id: number) => {
    const next = new Set(revealedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setRevealedIds(next)
  }

  const handleCopy = async (p: PileteroOut) => {
    await navigator.clipboard.writeText(p.api_key)
    setCopiedId(p.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await pileterosApi.create({ name: newName.trim(), phone: newPhone.trim() || undefined })
      setNewName('')
      setNewPhone('')
      setShowCreateForm(false)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al crear piletero')
    } finally {
      setCreating(false)
    }
  }

  const handleRegenerate = async (p: PileteroOut) => {
    setRegenModal(null)
    setActioningId(p.id)
    try {
      await pileterosApi.regenerateKey(p.id)
      // Revelar la nueva key automáticamente
      setRevealedIds((prev) => new Set([...prev, p.id]))
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al regenerar key')
    } finally {
      setActioningId(null)
    }
  }

  const handleDeactivate = async (p: PileteroOut) => {
    setDeactivateModal(null)
    setActioningId(p.id)
    try {
      await pileterosApi.deactivate(p.id)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al desactivar piletero')
    } finally {
      setActioningId(null)
    }
  }

  const handleReactivate = async (p: PileteroOut) => {
    setActioningId(p.id)
    try {
      await pileterosApi.update(p.id, { is_active: true })
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al reactivar piletero')
    } finally {
      setActioningId(null)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <UserCog className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-800">Pileteros</h1>
          <span className="ml-2 bg-slate-200 text-slate-600 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {pileteros.filter((p) => p.is_active).length} activos
          </span>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo piletero
        </button>
      </div>

      {/* Formulario crear */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Nuevo piletero</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Nombre *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Teléfono (opcional)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Guardando…' : 'Crear'}
            </button>
            <button
              onClick={() => { setShowCreateForm(false); setNewName(''); setNewPhone('') }}
              className="px-4 py-2 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      {pileteros.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No hay pileteros registrados todavía.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Teléfono</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">API Key</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Estado</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pileteros.map((p) => {
                const revealed = revealedIds.has(p.id)
                const acting = actioningId === p.id
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                    {/* Nombre */}
                    <td className="px-5 py-3 font-medium text-slate-800">{p.name}</td>

                    {/* Teléfono */}
                    <td className="px-5 py-3 text-slate-500">
                      {p.phone ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* API Key */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs bg-slate-100 rounded px-2 py-1 text-slate-700 select-all">
                          {revealed ? p.api_key : obfuscate(p.api_key)}
                        </code>
                        <button
                          onClick={() => toggleReveal(p.id)}
                          title={revealed ? 'Ocultar' : 'Mostrar'}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleCopy(p)}
                          title="Copiar API key"
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {copiedId === p.id ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="px-5 py-3">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <UserX className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Regenerar key */}
                        <button
                          onClick={() => setRegenModal(p)}
                          disabled={acting}
                          title="Regenerar API key"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Regenerar
                        </button>

                        {/* Desactivar / reactivar */}
                        {p.is_active ? (
                          <button
                            onClick={() => setDeactivateModal(p)}
                            disabled={acting}
                            title="Desactivar piletero"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Desactivar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(p)}
                            disabled={acting}
                            title="Reactivar piletero"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal regenerar key */}
      {regenModal && (
        <ConfirmModal
          open={true}
          title="Regenerar API key"
          description={`¿Regenerar la API key de ${regenModal.name}? La clave actual dejará de funcionar inmediatamente en la app móvil.`}
          confirmLabel="Regenerar"
          variant="danger"
          onConfirm={() => handleRegenerate(regenModal)}
          onCancel={() => setRegenModal(null)}
        />
      )}

      {/* Modal desactivar */}
      {deactivateModal && (
        <ConfirmModal
          open={true}
          title="Desactivar piletero"
          description={`¿Desactivar a ${deactivateModal.name}? No podrá autenticarse en la app móvil hasta que lo reactives.`}
          confirmLabel="Desactivar"
          variant="danger"
          onConfirm={() => handleDeactivate(deactivateModal)}
          onCancel={() => setDeactivateModal(null)}
        />
      )}
    </div>
  )
}

export default Pileteros
