import { api } from './client';

export interface OrphanCandidate {
  invoice_id: number;
  client_id: number;
  client_name: string;
  period: string;
  total: number;
  pending_amount: number;
  due_date: string | null;
  status: string;
  score: number;
  reasons: string[];
}

export interface OrphanPaymentSummary {
  id: number;
  mp_payment_id: string;
  amount: number;
  paid_at: string;
  payer_name: string | null;
  payer_dni: string | null;
  payment_type: string | null;
  payment_method: string | null;
  status: 'pending_review' | 'assigned' | 'discarded';
  created_at: string;
  top_candidate_score: number | null;
  top_candidate_client: string | null;
}

export interface OrphanPaymentDetail extends OrphanPaymentSummary {
  resolved_at: string | null;
  assigned_invoice_id: number | null;
  assigned_payment_id: number | null;
  candidates: OrphanCandidate[];
}

export const orphanPaymentsApi = {
  list: async (status: 'pending_review' | 'assigned' | 'discarded' | 'all' = 'pending_review') => {
    const { data } = await api.get<OrphanPaymentSummary[]>('/orphan-payments', {
      params: { status },
    });
    return data;
  },

  get: async (id: number) => {
    const { data } = await api.get<OrphanPaymentDetail>(`/orphan-payments/${id}`);
    return data;
  },

  assign: async (id: number, invoiceId: number) => {
    const { data } = await api.post(`/orphan-payments/${id}/assign`, null, {
      params: { invoice_id: invoiceId },
    });
    return data;
  },

  discard: async (id: number, reason?: string) => {
    const { data } = await api.post(`/orphan-payments/${id}/discard`, null, {
      params: reason ? { reason } : {},
    });
    return data;
  },

  pendingCount: async () => {
    const { data } = await api.get<{ pending: number }>('/orphan-payments/stats/pending-count');
    return data.pending;
  },
};
