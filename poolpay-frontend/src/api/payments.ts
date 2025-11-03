import { api } from './client';
import type { Payment, PaymentCreate } from '../types';

export const paymentsApi = {
  getAll: async (invoice_id?: number) => {
    const params = invoice_id ? { invoice_id } : {};
    const { data } = await api.get<Payment[]>('/payments', { params });
    return data;
  },

  getById: async (id: number) => {
    const { data } = await api.get<Payment>(`/payments/${id}`);
    return data;
  },

  create: async (payment: PaymentCreate) => {
    const { data } = await api.post<Payment>('/payments', payment);
    return data;
  },

  delete: async (id: number) => {
    await api.delete(`/payments/${id}`);
  },
};

