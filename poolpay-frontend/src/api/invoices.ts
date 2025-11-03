import { api } from './client';
import type { Invoice, InvoiceCreate } from '../types';

export const invoicesApi = {
  getAll: async (filters?: { client_id?: number; period?: string; status?: string }) => {
    const { data } = await api.get<Invoice[]>('/invoices', { params: filters });
    return data;
  },

  getById: async (id: number) => {
    const { data} = await api.get<Invoice>(`/invoices/${id}`);
    return data;
  },

  create: async (invoice: InvoiceCreate) => {
    const { data } = await api.post<Invoice>('/invoices', invoice);
    return data;
  },

  update: async (id: number, updates: Partial<Invoice>) => {
    const { data } = await api.patch<Invoice>(`/invoices/${id}`, updates);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/invoices/${id}`);
  },
};

