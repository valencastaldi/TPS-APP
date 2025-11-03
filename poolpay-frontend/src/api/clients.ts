import { api } from './client';
import type { Client, ClientCreate, ClientUpdate } from '../types';

export const clientsApi = {
  getAll: async (active?: boolean) => {
    const params = active !== undefined ? { active } : {};
    const { data } = await api.get<Client[]>('/clients', { params });
    return data;
  },

  getById: async (id: number) => {
    const { data } = await api.get<Client>(`/clients/${id}`);
    return data;
  },

  create: async (client: ClientCreate) => {
    const { data } = await api.post<Client>('/clients', client);
    return data;
  },

  update: async (id: number, client: ClientUpdate) => {
    const { data } = await api.patch<Client>(`/clients/${id}`, client);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/clients/${id}`);
  },
};

