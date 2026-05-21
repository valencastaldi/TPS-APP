import { api } from './client';

export interface ServiceVisitOut {
  id: number;
  client_id: number;
  client_name: string;
  piletero_id: number | null;
  piletero_name: string | null;
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
  whatsapp_sent_at: string | null;
  whatsapp_error: string | null;
  wame_url: string | null;
}

export const serviceVisitsApi = {
  list: async (params?: { client_id?: number; piletero_id?: number }) => {
    const { data } = await api.get<ServiceVisitOut[]>('/service-visits', { params });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<ServiceVisitOut>(`/service-visits/${id}`);
    return data;
  },

  resendWhatsapp: async (id: number) => {
    const { data } = await api.post<{ ok: boolean; status: string; wame_url: string | null }>(
      `/service-visits/${id}/resend-whatsapp`
    );
    return data;
  },

  remove: async (id: number) => {
    const { data } = await api.delete<{ ok: boolean; id: number }>(`/service-visits/${id}`);
    return data;
  },
};
