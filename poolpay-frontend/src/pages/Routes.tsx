import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, MapPin, User, Users, Search } from 'lucide-react'
import { routesApi, type RouteDay } from '../api/routes'
import { clientsApi } from '../api/clients'
import type { Client } from '../types'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// ── Helpers de fecha (sin librerías) ──────────────────────────────────────────
const toISO = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const mondayOf = (d: Date) => {
  const date = new Date(d)
  const dow = (date.getDay() + 6) % 7 // 0 = lunes
  date.setDate(date.getDate() - dow)
  date.setHours(0, 0, 0, 0)
  return date
}

const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const Routes = () => {
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()))
  const [days, setDays] = useState<RouteDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [neighborhoods, setNeighborhoods] = useState<string[]>([])
  const [allClients, setAllClients] = useState<Client[]>([])

  const [expanded, setExpanded] = useState<string | null>(null)       // fecha con lista de clientes abierta
  const [clientPickerDate, setClientPickerDate] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const loadWeek = async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(weekDates.map((d) => routesApi.day(toISO(d))))
      setDays(results)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message ?? 'Error cargando rutas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWeek()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  useEffect(() => {
    // Barrios disponibles + clientes para el selector puntual
    clientsApi.getGroupedByNeighborhood()
      .then((g) => setNeighborhoods(g.map((x) => x.neighborhood).filter((n) => n && n !== 'Sin barrio')))
      .catch(() => {})
    clientsApi.getAll().then(setAllClients).catch(() => {})
  }, [])

  const dayByDate = (iso: string) => days.find((d) => d.date === iso)

  const handleAddNeighborhood = async (date: string, neighborhood: string) => {
    if (!neighborhood) return
    setBusy(true)
    try {
      await routesApi.addNeighborhood(date, neighborhood)
      await loadWeek()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al agregar barrio')
    } finally {
      setBusy(false)
    }
  }

  const handleAddClient = async (date: string, clientId: number) => {
    setBusy(true)
    try {
      await routesApi.addClient(date, clientId)
      setClientPickerDate(null)
      setClientSearch('')
      await loadWeek()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error al agregar cliente')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (entryId: number) => {
    setBusy(true)
    try {
      await routesApi.removeEntry(entryId)
      await loadWeek()
    } catch {
      alert('Error al quitar')
    } finally {
      setBusy(false)
    }
  }

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim()
    const base = q
      ? allClients.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          (c.neighborhood ?? '').toLowerCase().includes(q))
      : allClients
    return base.slice(0, 30)
  }, [clientSearch, allClients])

  const todayISO = toISO(new Date())

  if (loading) return <Spinner text="Cargando rutas..." />
  if (error) return <ErrorState message={error} onRetry={loadWeek} />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-800">Rutas</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekStart(mondayOf(new Date()))}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Hoy
          </button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid semanal */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {weekDates.map((d, i) => {
          const iso = toISO(d)
          const day = dayByDate(iso)
          const neighborhoodEntries = day?.entries.filter((e) => e.neighborhood) ?? []
          const clientEntries = day?.entries.filter((e) => e.client_id) ?? []
          const availableNeighborhoods = neighborhoods.filter(
            (n) => !neighborhoodEntries.some((e) => e.neighborhood === n))
          const isToday = iso === todayISO

          return (
            <div key={iso}
              className={`bg-white rounded-xl border ${isToday ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'} p-4 flex flex-col`}>
              {/* Día */}
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-800">{WEEKDAYS[i]}</div>
                  <div className="text-xs text-slate-400">
                    {d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Users className="w-3 h-3" /> {day?.clients.length ?? 0}
                </span>
              </div>

              {/* Barrios */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {neighborhoodEntries.map((e) => (
                  <span key={e.id}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                    <MapPin className="w-3 h-3" />
                    {e.neighborhood}
                    <button onClick={() => handleRemove(e.id)} disabled={busy}
                      className="hover:text-blue-900"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {clientEntries.map((e) => (
                  <span key={e.id}
                    className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded-full">
                    <User className="w-3 h-3" />
                    {e.client_name}
                    <button onClick={() => handleRemove(e.id)} disabled={busy}
                      className="hover:text-emerald-900"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {neighborhoodEntries.length === 0 && clientEntries.length === 0 && (
                  <span className="text-xs text-slate-300">Sin asignaciones</span>
                )}
              </div>

              {/* Agregar */}
              <div className="mt-auto pt-3 space-y-2">
                <select
                  value=""
                  disabled={busy || availableNeighborhoods.length === 0}
                  onChange={(e) => handleAddNeighborhood(iso, e.target.value)}
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-50"
                >
                  <option value="">+ Agregar barrio…</option>
                  {availableNeighborhoods.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button onClick={() => { setClientPickerDate(iso); setClientSearch('') }}
                    className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                    <Plus className="w-3 h-3" /> Cliente
                  </button>
                  {(day?.clients.length ?? 0) > 0 && (
                    <button onClick={() => setExpanded(expanded === iso ? null : iso)}
                      className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                      {expanded === iso ? 'Ocultar' : 'Ver clientes'}
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de clientes del día */}
              {expanded === iso && day && (
                <div className="mt-3 border-t border-slate-100 pt-2 space-y-1 max-h-60 overflow-auto">
                  {day.clients.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs py-1">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-700 truncate">{c.name}</div>
                        <div className="text-slate-400 truncate">{c.neighborhood} · {c.address ?? 's/dirección'}</div>
                      </div>
                      <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${c.source === 'puntual' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.source}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal: elegir cliente puntual */}
      {clientPickerDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setClientPickerDate(null)}>
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Agregar cliente al {clientPickerDate}</h3>
              <button onClick={() => setClientPickerDate(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input autoFocus value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre o barrio…"
                  className="flex-1 py-2 text-sm outline-none" />
              </div>
            </div>
            <div className="overflow-auto px-2 pb-2">
              {filteredClients.map((c) => (
                <button key={c.id} disabled={busy}
                  onClick={() => handleAddClient(clientPickerDate, c.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{c.name}</div>
                    <div className="text-xs text-slate-400 truncate">{c.neighborhood ?? 'Sin barrio'}</div>
                  </div>
                </button>
              ))}
              {filteredClients.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-6">Sin resultados</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Routes
