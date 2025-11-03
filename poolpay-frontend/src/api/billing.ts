import { api } from './client';
import type { BillingGenerate, BillingSummary, GeneralStats, Invoice } from '../types';

export const billingApi = {
  generate: async (data: BillingGenerate) => {
    const response = await api.post('/billing/generate', data);
    return response.data;
  },

  getSummary: async (period: string) => {
    const { data } = await api.get<BillingSummary>(`/billing/summary/${period}`);
    return data;
  },

  getOverdue: async () => {
    const { data } = await api.get<Invoice[]>('/billing/overdue');
    return data;
  },

  getStats: async () => {
    const { data } = await api.get<GeneralStats>('/billing/stats');
    return data;
  },
};

