import { useEffect, useState } from 'react'
import { clientsApi } from '../api/clients'
import { Plus, Edit, Trash2, Phone, MapPin, ChevronDown, ChevronRight, Map } from 'lucide-react'
import type { Client, ClientCreate } from '../types'
import Spinner from '../components/Spinner'
import ErrorState from '../components/ErrorState'
import ClientMap from '../components/ClientMap'

const NEIGHBORHOODS = [
  'CUATRO HOJAS',
  'TERRON',
  'ESTANCIA Q2',
  'ZONA GOLF',
  'VALLE DEL SOL',
  'SAN ALFONSO',
  'SAN ISIDRO',
  'VILLA ALLENDE',
] as const

const Clients = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [mapClient, setMapClient] = useState<Client | null>(null)
  const [grouped, setGrouped] = useState<{ neighborhood: string; count: number; clients: Client[] }[]>([])
  const [expandedNeighborhoods, setExpandedNeighborhoods] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await clientsApi.getGroupedByNeighborhood()
      setGrouped(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  const toggleNeighborhood = (neighborhood: string) => {
    setExpandedNeighborhoods((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(neighborhood)) {
        newSet.delete(neighborhood)
      } else {
        newSet.add(neighborhood)
      }
      return newSet
    })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return
    try {
      await clientsApi.delete(id)
      loadClients()
    } catch (error) {
      alert('Error al eliminar cliente')
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const priceRaw = formData.get('price') as string | null

    const clientData: ClientCreate = {
      name: formData.get('name') as string,
      phone: (formData.get('phone') as string) || undefined,
      whatsapp: (formData.get('whatsapp') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      city: (formData.get('city') as string) || undefined,
      neighborhood: (formData.get('neighborhood') as string) || undefined,
      plan: formData.get('plan') as 'semanal' | 'quincenal' | 'mensual',
      price: priceRaw ? Number(priceRaw) : undefined, // opcional
      is_active: formData.get('is_active') === 'on',
    }

    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, clientData)
      } else {
        await clientsApi.create(clientData)
      }
      setShowForm(false)
      setEditingClient(null)
      loadClients()
    } catch (error) {
      alert('Error al guardar cliente')
    }
  }

  if (loading) return <Spinner text="Cargando clientes..." />
  if (error) return <ErrorState message={error} onRetry={loadClients} />

  return (
    <>
    {mapClient && <ClientMap client={mapClient} onClose={() => setMapClient(null)} />}
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">Organizados por barrio</p>
        </div>
        <button
          onClick={() => {
            setEditingClient(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingClient?.name}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingClient?.phone}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    name="whatsapp"
                    defaultValue={editingClient?.whatsapp}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  defaultValue={editingClient?.address}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="city"
                    defaultValue={editingClient?.city}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Barrio
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <select
                      name="neighborhood"
                      defaultValue={editingClient?.neighborhood}
                      required
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    >
                      <option value="">Seleccione un barrio</option>
                      {NEIGHBORHOODS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan *
                  </label>
                  <select
                    name="plan"
                    defaultValue={editingClient?.plan || 'mensual'}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio (opcional)
                  </label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    defaultValue={editingClient?.price}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  id="is_active"
                  defaultChecked={editingClient?.is_active ?? true}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                  Cliente activo
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingClient(null)
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vista agrupada por barrio - Acordeón */}
      <div className="space-y-3">
        {grouped.map((g) => {
          const isExpanded = expandedNeighborhoods.has(g.neighborhood)
          return (
            <div key={g.neighborhood} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header del acordeón */}
              <button
                onClick={() => toggleNeighborhood(g.neighborhood)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  )}
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-800 text-lg">{g.neighborhood}</h4>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {g.count} {g.count === 1 ? 'cliente' : 'clientes'}
                  </span>
                </div>
              </button>

              {/* Contenido expandible */}
              {isExpanded && (
                <div className="border-t">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cliente
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contacto
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plan
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Precio
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {g.clients.map((client) => (
                          <tr key={client.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{client.name}</div>
                              {client.address && (
                                <div className="text-sm text-gray-500">{client.address}</div>
                              )}
                              {client.city && (
                                <div className="text-xs text-gray-400">{client.city}</div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1 text-sm text-gray-500">
                                {client.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {client.phone}
                                  </span>
                                )}
                                {client.whatsapp && client.whatsapp !== client.phone && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <Phone className="w-3 h-3" />
                                    {client.whatsapp}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {client.plan}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              ${client.price.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  client.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {client.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => setMapClient(client)}
                                className="text-slate-400 hover:text-blue-600 mr-3 transition-colors"
                                title="Ver en mapa"
                              >
                                <Map className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(client)}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(client.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        })}

        {grouped.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center text-slate-400 text-sm">
            No hay clientes registrados. Hacé clic en "Nuevo Cliente" para agregar uno.
          </div>
        )}
      </div>
    </div>
    </>
  )
}

export default Clients
