import { api } from './client';

export interface RouteEntry {
  id: number;
  date: string;
  neighborhood: string | null;
  client_id: number | null;
  client_name: string | null;
}

export interface RouteClientItem {
  id: number;
  name: string;
  address: string | null;
  neighborhood: string | null;
  phone: string | null;
  plan: string;
  price: number;
  lat: number | null;
  lng: number | null;
  source: 'barrio' | 'puntual';
}

export interface RouteDay {
  date: string;
  neighborhoods: string[];
  entries: RouteEntry[];
  clients: RouteClientItem[];
}

export interface RouteDaySummary {
  date: string;
  neighborhoods: string[];
  total_clients: number;
}

export const routesApi = {
  range: async (date_from: string, date_to: string) => {
    const { data } = await api.get<RouteDaySummary[]>('/routes', {
      params: { date_from, date_to },
    });
    return data;
  },

  day: async (date: string) => {
    const { data } = await api.get<RouteDay>(`/routes/${date}`);
    return data;
  },

  addNeighborhood: async (date: string, neighborhood: string) => {
    const { data } = await api.post<RouteEntry>('/routes', { date, neighborhood });
    return data;
  },

  addClient: async (date: string, client_id: number) => {
    const { data } = await api.post<RouteEntry>('/routes', { date, client_id });
    return data;
  },

  removeEntry: async (id: number) => {
    await api.delete(`/routes/${id}`);
  },
};
