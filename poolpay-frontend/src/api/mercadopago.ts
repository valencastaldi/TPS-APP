import { api } from './client';

export interface CreatePaymentLinkRequest {
  invoice_id: number;
  client_email: string;
  description?: string;
}

export interface PaymentLinkResponse {
  success: boolean;
  payment_link?: string;
  preference_id?: string;
  error?: string;
}

export const mercadopagoApi = {
  createPaymentLink: async (payload: CreatePaymentLinkRequest) => {
    const { data } = await api.post<PaymentLinkResponse>(
      '/mercadopago/create-payment-link',
      payload,
    );
    return data;
  },
};
