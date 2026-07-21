import { supabase } from '../../lib/supabase';
import type { Invoice } from '../../types';
import { mockDb } from '../../utils/mockDb';
import { warnMockFallback } from '../../utils/devWarn';

// ─── DB ↔ APP ADAPTERS ────────────────────────────────────────────────────────
// The real `invoices` table has no `status` column — status is derived from
// paid_at / due_date. It also uses `paid_at` (timestamp) rather than `paid_date`.
//   DB column  →  Invoice field
//   paid_at    →  paid_date (+ drives `status`)
function deriveStatus(row: any): Invoice['status'] {
  if (row.paid_at) return 'paid';
  if (row.due_date) {
    const due = new Date(row.due_date);
    const today = new Date(new Date().toISOString().split('T')[0]);
    if (!isNaN(due.getTime()) && due < today) return 'overdue';
  }
  return 'sent';
}

function rowToInvoice(row: any): Invoice {
  return {
    id: row.id,
    load_id: row.load_id,
    amount: Number(row.amount) || 0,
    status: deriveStatus(row),
    due_date: row.due_date ?? '',
    paid_date: row.paid_at ? String(row.paid_at).split('T')[0] : undefined,
    created_at: row.created_at,
    client_name: row.client_name ?? undefined,
    driver_id: row.driver_id ?? undefined,
    invoice_number: row.invoice_number ?? undefined,
    driver_name: row.users?.full_name ?? row.driver_name ?? undefined,
  };
}

function invoiceToRow(invoice: Partial<Invoice>): Record<string, any> {
  const row: Record<string, any> = {};
  if (invoice.driver_id !== undefined) row.driver_id = invoice.driver_id;
  if (invoice.load_id !== undefined) row.load_id = invoice.load_id;
  if (invoice.amount !== undefined) row.amount = invoice.amount;
  if (invoice.due_date !== undefined) row.due_date = invoice.due_date;
  if (invoice.client_name !== undefined) row.client_name = invoice.client_name;
  if (invoice.invoice_number !== undefined) row.invoice_number = invoice.invoice_number;
  // `status` isn't a column — it's expressed through paid_at.
  if (invoice.status !== undefined) {
    row.paid_at = invoice.status === 'paid' ? new Date().toISOString() : null;
  } else if (invoice.paid_date !== undefined) {
    row.paid_at = invoice.paid_date ? new Date(invoice.paid_date).toISOString() : null;
  }
  return row;
}

export async function getFleetInvoices(companyId: string): Promise<Invoice[]> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getInvoices();
  }

  // NOTE: the real `users` table has no company_id column, so we can't scope by
  // company. Single business = owner sees every invoice; RLS is the real
  // security boundary here.
  void companyId;
  const { data, error } = await supabase
    .from('invoices')
    .select('*, users(full_name)');

  if (error || !data || data.length === 0) {
    warnMockFallback('getFleetInvoices', error);
    return mockDb.getInvoices();
  }

  return data.map(rowToInvoice);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: 'draft' | 'sent' | 'paid' | 'overdue'
): Promise<Invoice | null> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.updateInvoiceStatus(invoiceId, status);
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(invoiceToRow({ status }))
    .eq('id', invoiceId)
    .select()
    .single();

  if (error || !data) {
    return mockDb.updateInvoiceStatus(invoiceId, status);
  }

  return rowToInvoice(data);
}

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'created_at'>): Promise<Invoice> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.createInvoice(invoice);
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert([invoiceToRow(invoice)])
    .select()
    .single();

  if (error || !data) {
    return mockDb.createInvoice(invoice);
  }

  return rowToInvoice(data);
}
