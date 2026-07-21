import { supabase } from '../../lib/supabase';
import type { Expense } from '../../types';
import { mockDb } from '../../utils/mockDb';

// ─── DB ↔ APP ADAPTERS ────────────────────────────────────────────────────────
// The real Supabase `expenses` table uses different column names than the app's
// Expense shape (it's the schema MilesBot writes to). Translate at the service
// boundary so the rest of the app keeps using the Expense type unchanged.
//   DB column          →  Expense field
//   expense_date       →  date
//   notes              →  description
//   tax_deductible     →  is_deductible
//   receipt_image_url  →  receipt_url
function rowToExpense(row: any): Expense {
  return {
    id: row.id,
    driver_id: row.driver_id,
    category: row.category,
    amount: Number(row.amount) || 0,
    description: row.notes ?? row.vendor ?? '',
    receipt_url: row.receipt_image_url ?? undefined,
    date: row.expense_date ?? (row.created_at ? String(row.created_at).split('T')[0] : ''),
    is_deductible: row.tax_deductible ?? false,
    created_at: row.created_at,
    flagged: row.flagged ?? undefined,
    flag_reason: row.flag_reason ?? undefined,
    driver_name: row.driver_name ?? undefined,
  };
}

function expenseToRow(expense: Partial<Expense>): Record<string, any> {
  const row: Record<string, any> = {};
  if (expense.driver_id !== undefined) row.driver_id = expense.driver_id;
  if (expense.category !== undefined) row.category = expense.category;
  if (expense.amount !== undefined) row.amount = expense.amount;
  if (expense.description !== undefined) row.notes = expense.description;
  if (expense.date !== undefined) row.expense_date = expense.date;
  if (expense.is_deductible !== undefined) row.tax_deductible = expense.is_deductible;
  if (expense.receipt_url !== undefined) row.receipt_image_url = expense.receipt_url;
  if (expense.flagged !== undefined) row.flagged = expense.flagged;
  if (expense.flag_reason !== undefined) row.flag_reason = expense.flag_reason;
  return row;
}

export async function getExpenses(driverId: string): Promise<Expense[]> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getDriverExpenses(driverId);
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('driver_id', driverId)
    .order('expense_date', { ascending: false });

  if (error || !data || data.length === 0) {
    return mockDb.getDriverExpenses(driverId);
  }
  return data.map(rowToExpense);
}

export async function createExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.createExpense(expense);
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert([expenseToRow(expense)])
    .select()
    .single();

  if (error || !data) {
    return mockDb.createExpense(expense);
  }
  return rowToExpense(data);
}

export async function deleteExpense(expenseId: string): Promise<boolean> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    // In-memory delete
    const expenses = mockDb.getExpenses();
    const idx = expenses.findIndex((e) => e.id === expenseId);
    if (idx !== -1) {
      expenses.splice(idx, 1);
      return true;
    }
    return false;
  }

  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  return !error;
}

export async function updateExpense(expenseId: string, updates: Partial<Expense>): Promise<Expense | null> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.updateExpense(expenseId, updates);
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(expenseToRow(updates))
    .eq('id', expenseId)
    .select()
    .single();

  if (error || !data) {
    return mockDb.updateExpense(expenseId, updates);
  }
  return rowToExpense(data);
}

export async function getFleetExpenses(companyId: string): Promise<Expense[]> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getExpenses();
  }

  // Assuming expenses table has a driver relation to filter by company_id, or we query all expenses and filter
  const { data, error } = await supabase
    .from('expenses')
    .select('*, users!inner(company_id)')
    .eq('users.company_id', companyId);

  if (error || !data || data.length === 0) {
    return mockDb.getExpenses();
  }

  return data.map(rowToExpense);
}

// ─── RETIREMENT ───────────────────────────────────────────────────────────────
// Real table is `retirement_log` (singular). Its columns differ from the app's
// {amount, type, date} shape, and account_type is an enum (solo_401k, …) while
// the UI works in display labels ("Solo 401k"). Translate both directions.
const RET_ENUM_TO_LABEL: Record<string, string> = {
  solo_401k: 'Solo 401k',
  sep_ira: 'SEP IRA',
  simple_ira: 'SIMPLE IRA',
  roth_ira: 'Roth IRA',
  traditional_ira: 'Traditional IRA',
};

function retLabel(accountType: string | null | undefined): string {
  if (!accountType) return 'Retirement';
  return RET_ENUM_TO_LABEL[accountType] ?? accountType;
}

function retEnum(label: string | null | undefined): string {
  const v = String(label ?? '').toLowerCase();
  if (v.includes('solo')) return 'solo_401k';
  if (v.includes('sep')) return 'sep_ira';
  if (v.includes('simple')) return 'simple_ira';
  if (v.includes('roth')) return 'roth_ira';
  if (v.includes('traditional')) return 'traditional_ira';
  return 'solo_401k';
}

function rowToRetirement(row: any): any {
  return {
    id: row.id,
    driver_id: row.driver_id,
    amount: Number(row.actual_contribution) || 0,
    type: retLabel(row.account_type),
    date: row.created_at ? String(row.created_at).split('T')[0] : (row.period_end ?? ''),
  };
}

export async function createRetirementLog(retirementLog: {
  driver_id: string;
  amount: number;
  type: string;
  date: string;
}): Promise<any> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return { id: Math.random().toString(36).substr(2, 9), ...retirementLog };
  }

  const { data, error } = await supabase
    .from('retirement_log')
    .insert([{
      driver_id: retirementLog.driver_id,
      actual_contribution: retirementLog.amount,
      account_type: retEnum(retirementLog.type),
      limit_year: new Date(retirementLog.date).getFullYear() || new Date().getFullYear(),
    }])
    .select()
    .single();

  if (error || !data) {
    return { id: Math.random().toString(36).substr(2, 9), ...retirementLog };
  }
  return rowToRetirement(data);
}

export async function getRetirementLogs(driverId: string): Promise<any[]> {
  const mock = [
    { id: 'ret-1', driver_id: driverId, amount: 250, type: 'Solo 401k', date: '2026-05-22' },
    { id: 'ret-2', driver_id: driverId, amount: 250, type: 'Solo 401k', date: '2026-05-15' },
    { id: 'ret-3', driver_id: driverId, amount: 250, type: 'Solo 401k', date: '2026-05-08' },
    { id: 'ret-4', driver_id: driverId, amount: 250, type: 'Solo 401k', date: '2026-05-01' },
  ];

  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mock;
  }

  const { data, error } = await supabase
    .from('retirement_log')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return mock;
  }
  return data.map(rowToRetirement);
}
