import { useEffect, useState, useRef } from 'react'
import { MapPin, X, ExternalLink, Loader2 } from 'lucide-react'
import type { Client } from '../types'

// Leaflet se carga dinámicamente para evitar problemas con SSR/Vite
let L: typeof import('leaflet') | null = null

interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

async function geocode(address: string, city?: string): Promise<GeoResult | null> {
  const query = [address, city, 'Argentina'].filter(Boolean).join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=ar`
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
    const data = await res.json()
    if (!data.length) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    }
  } catch {
    return null
  }
}

interface ClientMapProps {
  client: Client
  onClose: () => void
}

const ClientMap = ({ client, onClose }: ClientMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null)

  useEffect(() => {
    let cancelled = false

    const initMap = async () => {
      // Importar Leaflet dinámicamente
      if (!L) {
        const leafletModule = await import('leaflet')
        await import('leaflet/dist/leaflet.css')
        L = leafletModule.default ?? (leafletModule as any)
      }

      if (!L || !mapRef.current || cancelled) return

      // Buscar coordenadas
      const address = [client.address, client.neighborhood, client.city]
        .filter(Boolean)
        .join(', ')

      if (!address.trim()) {
        setStatus('error')
        return
      }

      const geo = await geocode(address, client.city)
      if (cancelled) return

      if (!geo) {
        setStatus('error')
        return
      }

      setGeoResult(geo)

      // Inicializar mapa
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const map = L.map(mapRef.current, { zoomControl: true }).setView(
        [geo.lat, geo.lng],
        17
      )

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 20,
      }).addTo(map)

      // Ícono personalizado
      const icon = L.divIcon({
        html: `<div style="background:#3b82f6;border:3px solid white;border-radius:50% 50% 50% 0;width:28px;height:28px;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        className: '',
      })

      L.marker([geo.lat, geo.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<strong>${client.name}</strong><br>${client.address ?? ''}${client.neighborhood ? ` — ${client.neighborhood}` : ''}`,
          { closeButton: false }
        )
        .openPopup()

      mapInstanceRef.current = map
      setStatus('ok')
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [client])

  const googleMapsUrl = client.address
    ? `https://www.google.com/maps/search/${encodeURIComponent(
        [client.address, client.neighborhood, client.city, 'Argentina'].filter(Boolean).join(', ')
      )}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-2">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{client.name}</h3>
              <p className="text-sm text-slate-500">
                {[client.address, client.neighborhood, client.city].filter(Boolean).join(' · ') || 'Sin dirección registrada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Google Maps
              </a>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Map container */}
        <div className="relative" style={{ height: '420px' }}>
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Buscando ubicación...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 gap-3">
              <MapPin className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500 text-center px-8">
                No se pudo encontrar la ubicación.<br />
                Verificá que la dirección esté completa.
              </p>
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buscar en Google Maps
                </a>
              )}
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Footer */}
        {geoResult && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400 truncate">{geoResult.displayName}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClientMap
