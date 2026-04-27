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

  exportExcel: async (period: string) => {
    const response = await api.get(`/billing/export/excel/${period}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `poolpay_${period}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};

