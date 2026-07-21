import { supabase } from '../../lib/supabase';
import type { Load } from '../../types';
import { mockDb } from '../../utils/mockDb';
import { warnMockFallback } from '../../utils/devWarn';

// ─── DB ↔ APP ADAPTERS ────────────────────────────────────────────────────────
// The real `loads` table splits the route into city/state columns and has no
// `updated_at` or `notes` column. Translate at the service boundary so the rest
// of the app keeps using the Load type unchanged.
//   origin_city + origin_state            →  origin       ("Atlanta, GA")
//   destination_city + destination_state  →  destination
function joinPlace(city?: string | null, state?: string | null): string {
  const c = (city ?? '').trim();
  const s = (state ?? '').trim();
  if (c && s) return `${c}, ${s}`;
  return c || s || '';
}

// "Atlanta, GA" / "Atlanta GA" → { city: "Atlanta", state: "GA" }
function splitPlace(place?: string | null): { city: string | null; state: string | null } {
  const raw = (place ?? '').trim();
  if (!raw) return { city: null, state: null };
  const comma = raw.lastIndexOf(',');
  if (comma !== -1) {
    const city = raw.slice(0, comma).trim();
    const state = raw.slice(comma + 1).trim();
    return { city: city || null, state: state || null };
  }
  const parts = raw.split(/\s+/);
  const last = parts[parts.length - 1];
  if (parts.length > 1 && /^[A-Za-z]{2}$/.test(last)) {
    return { city: parts.slice(0, -1).join(' '), state: last.toUpperCase() };
  }
  return { city: raw, state: null };
}

function rowToLoad(row: any): Load {
  return {
    id: row.id,
    driver_id: row.driver_id,
    driver_name: row.users?.full_name ?? undefined,
    broker_name: row.broker_name ?? '',
    origin: joinPlace(row.origin_city, row.origin_state),
    destination: joinPlace(row.destination_city, row.destination_state),
    rate: Number(row.rate) || 0,
    miles: Number(row.miles) || 0,
    status: row.status,
    pickup_date: row.pickup_date ?? (row.created_at ? String(row.created_at).split('T')[0] : ''),
    delivery_date: row.delivery_date ?? undefined,
    notes: undefined, // no `notes` column on loads
    created_at: row.created_at,
    updated_at: row.created_at, // no `updated_at` column; mirror created_at
  };
}

function loadToRow(load: Partial<Load>): Record<string, any> {
  const row: Record<string, any> = {};
  if (load.driver_id !== undefined) row.driver_id = load.driver_id;
  if (load.broker_name !== undefined) row.broker_name = load.broker_name;
  if (load.rate !== undefined) row.rate = load.rate;
  if (load.miles !== undefined) row.miles = load.miles;
  if (load.status !== undefined) row.status = load.status;
  if (load.pickup_date !== undefined) row.pickup_date = load.pickup_date;
  if (load.delivery_date !== undefined) row.delivery_date = load.delivery_date;
  if (load.origin !== undefined) {
    const o = splitPlace(load.origin);
    row.origin_city = o.city;
    row.origin_state = o.state;
  }
  if (load.destination !== undefined) {
    const d = splitPlace(load.destination);
    row.destination_city = d.city;
    row.destination_state = d.state;
  }
  if (load.rate !== undefined && load.miles) {
    row.rate_per_mile = Number((load.rate / load.miles).toFixed(2));
  }
  return row;
}

export async function getLoads(driverId: string): Promise<Load[]> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getDriverLoads(driverId);
  }

  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('driver_id', driverId)
    .order('pickup_date', { ascending: false });

  if (error || !data || data.length === 0) {
    warnMockFallback('getLoads', error);
    return mockDb.getDriverLoads(driverId);
  }
  return data.map(rowToLoad);
}

export async function getWeeklyLoads(driverId: string): Promise<Load[]> {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getDriverLoads(driverId).filter((l) => l.pickup_date >= startOfWeekStr);
  }

  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('driver_id', driverId)
    .gte('pickup_date', startOfWeekStr);

  if (error || !data || data.length === 0) {
    return mockDb.getDriverLoads(driverId).filter((l) => l.pickup_date >= startOfWeekStr);
  }
  return data.map(rowToLoad);
}

export async function getLoad(loadId: string): Promise<Load | null> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getLoads().find((l) => l.id === loadId) || null;
  }

  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('id', loadId)
    .single();

  if (error || !data) {
    return mockDb.getLoads().find((l) => l.id === loadId) || null;
  }
  return rowToLoad(data);
}

export async function createLoad(load: Omit<Load, 'id' | 'created_at' | 'updated_at'>): Promise<Load> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.createLoad(load);
  }

  const { data, error } = await supabase
    .from('loads')
    .insert([loadToRow(load)])
    .select()
    .single();

  if (error || !data) {
    return mockDb.createLoad(load);
  }
  return rowToLoad(data);
}

export async function createRateRecord(rateRecord: {
  load_id: string;
  rate: number;
  miles: number;
  rate_per_mile: number;
}): Promise<any> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return { id: Math.random().toString(36).substr(2, 9), ...rateRecord };
  }

  const { data, error } = await supabase
    .from('rate_records')
    .insert([rateRecord])
    .select()
    .single();

  if (error || !data) {
    return { id: Math.random().toString(36).substr(2, 9), ...rateRecord };
  }
  return data;
}

export async function deleteLoad(loadId: string): Promise<boolean> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    // In-memory delete
    const loads = mockDb.getLoads();
    const idx = loads.findIndex((l) => l.id === loadId);
    if (idx !== -1) {
      loads.splice(idx, 1);
      return true;
    }
    return false;
  }

  const { error } = await supabase.from('loads').delete().eq('id', loadId);
  return !error;
}

export async function getFleetLoads(companyId: string): Promise<Load[]> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getLoads();
  }

  // NOTE: the real `users` table has no company_id column (no multi-tenancy in
  // the DB today), so we can't scope by company. Single business = owner sees
  // every driver's loads; RLS is the real security boundary here.
  void companyId;
  const { data, error } = await supabase
    .from('loads')
    .select('*, users(full_name)');

  if (error || !data || data.length === 0) {
    warnMockFallback('getFleetLoads', error);
    return mockDb.getLoads();
  }

  return data.map(rowToLoad);
}
