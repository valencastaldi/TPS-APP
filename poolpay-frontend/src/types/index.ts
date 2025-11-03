export type Plan = 'semanal' | 'quincenal' | 'mensual';
export type Status = 'pendiente' | 'pagado' | 'parcial' | 'vencido';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'mercado_pago';

export interface Client {
  id: number;
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  plan: Plan;
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface ClientCreate {
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  plan: Plan;
  price: number;
  is_active?: boolean;
}

export interface ClientUpdate {
  name?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city?: string;
  plan?: Plan;
  price?: number;
  is_active?: boolean;
}

export interface Invoice {
  id: number;
  client_id: number;
  period: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  extras: number;
  total: number;
  status: Status;
}

export interface InvoiceCreate {
  client_id: number;
  period: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  extras?: number;
  status?: Status;
}

export interface Payment {
  id: number;
  invoice_id: number;
  paid_at: string;
  method: PaymentMethod;
  amount: number;
  notes?: string;
}

export interface PaymentCreate {
  invoice_id: number;
  method: PaymentMethod;
  amount: number;
  notes?: string;
}

export interface BillingGenerate {
  period: string;
  due_day?: number;
}

export interface BillingSummary {
  period: string;
  total_invoices: number;
  total_amount: number;
  paid: number;
  pending: number;
  partial: number;
  overdue: number;
  collected: number;
  pending_amount: number;
}

export interface GeneralStats {
  total_clients: number;
  active_clients: number;
  inactive_clients: number;
  total_invoices: number;
  total_payments: number;
  total_billed: number;
  total_collected: number;
  pending_collection: number;
}

