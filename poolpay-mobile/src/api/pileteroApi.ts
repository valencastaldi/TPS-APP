import { api } from './client';

export interface PileteroProfile {
  id: number;
  name: string;
  phone: string | null;
}

export interface ClientMapItem {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  plan: string;
  assigned_days: string | null;
  price: number;
  lat: number | null;
  lng: number | null;
}

export interface MyVisit {
  id: number;
  client_id: number;
  client_name: string;
  visited_at: string;
  duration_minutes: number | null;
  products_used: string | null;
  notes: string | null;
  price: number;
  invoice_id: number | null;
  invoice_status: string | null;
  paid_cash: boolean;
  payment_link_url: string | null;
  whatsapp_status: 'pending' | 'sent' | 'failed' | 'no_phone';
}

export interface RouteToday {
  date: string;
  neighborhoods: string[];
  clients: ClientMapItem[];
}

export interface CreateVisitPayload {
  client_id: number;
  visited_at?: string;
  duration_minutes?: number;
  products_used?: string;
  notes?: string;
  price?: number;
  paid_cash?: boolean;
}

export interface ServiceVisitOut extends MyVisit {
  piletero_id: number | null;
  piletero_name: string | null;
}

export const pileteroApi = {
  // Valida la API key y devuelve el perfil
  getProfile: async (): Promise<PileteroProfile> => {
    const { data } = await api.get<PileteroProfile>('/piletero/profile');
    return data;
  },

  // Lista de clientes para seleccionar al registrar visita
  getClients: async (): Promise<ClientMapItem[]> => {
    const { data } = await api.get<ClientMapItem[]>('/piletero/clients');
    return data;
  },

  // Ruta del día (barrios + clientes a visitar hoy)
  getRouteToday: async (): Promise<RouteToday> => {
    const { data } = await api.get<RouteToday>('/piletero/route');
    return data;
  },

  // Mis visitas
  getMyVisits: async (): Promise<MyVisit[]> => {
    const { data } = await api.get<MyVisit[]>('/piletero/my-visits');
    return data;
  },

  // Registrar visita (POST /service-visits)
  createVisit: async (payload: CreateVisitPayload): Promise<ServiceVisitOut> => {
    const { data } = await api.post<ServiceVisitOut>('/service-visits', payload);
    return data;
  },

  // Actualizar coordenadas del cliente (se llama al registrar si hay GPS)
  updateClientCoords: async (clientId: number, lat: number, lng: number) => {
    await api.patch(`/piletero/clients/${clientId}/coords`, { lat, lng });
  },
};
