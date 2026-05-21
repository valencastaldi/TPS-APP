import { api } from './client';

export interface PileteroOut {
  id: number;
  name: string;
  phone: string | null;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

export const pileterosApi = {
  list: async () => {
    const { data } = await api.get<PileteroOut[]>('/pileteros');
    return data;
  },

  create: async (payload: { name: string; phone?: string }) => {
    const { data } = await api.post<PileteroOut>('/pileteros', payload);
    return data;
  },

  update: async (id: number, payload: { name?: string; phone?: string; is_active?: boolean }) => {
    const { data } = await api.patch<PileteroOut>(`/pileteros/${id}`, payload);
    return data;
  },

  deactivate: async (id: number) => {
    const { data } = await api.delete<{ ok: boolean; id: number; is_active: boolean }>(`/pileteros/${id}`);
    return data;
  },

  regenerateKey: async (id: number) => {
    const { data } = await api.post<PileteroOut>(`/pileteros/${id}/regenerate-key`);
    return data;
  },
};
