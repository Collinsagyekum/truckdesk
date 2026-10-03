import { supabase } from '../../lib/supabase';
import type { Load } from '../../types';
import { getFleetDriverIds } from './users';

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

// Reads throw on a query error and return [] / null when there is simply no
// data, so pages can tell "couldn't load" apart from "nothing here yet".
// Writes throw on failure: a save that didn't happen must never look like one.

export async function getLoads(driverId: string): Promise<Load[]> {
  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('driver_id', driverId)
    .order('pickup_date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rowToLoad);
}

export async function getWeeklyLoads(driverId: string): Promise<Load[]> {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Fetch the driver's loads and filter "this week" in JS on the mapped date.
  // Loads logged by MilesBot have a null pickup_date (only delivery_date is
  // set), so filtering the raw pickup_date column in SQL silently drops them.
  // rowToLoad falls pickup_date back to created_at, which is exactly how the
  // owner dashboard decides "this week" — so the two views stay consistent.
  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('driver_id', driverId);

  if (error) throw error;
  return (data ?? [])
    .map(rowToLoad)
    .filter((load) => new Date(load.pickup_date) >= startOfWeek);
}

export async function getLoad(loadId: string): Promise<Load | null> {
  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('id', loadId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToLoad(data) : null;
}

export async function createLoad(load: Omit<Load, 'id' | 'created_at' | 'updated_at'>): Promise<Load> {
  const { data, error } = await supabase
    .from('loads')
    .insert([loadToRow(load)])
    .select()
    .single();

  if (error) throw error;
  return rowToLoad(data);
}

export async function createRateRecord(rateRecord: {
  load_id: string;
  rate: number;
  miles: number;
  rate_per_mile: number;
}): Promise<any> {
  const { data, error } = await supabase
    .from('rate_records')
    .insert([rateRecord])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Returns false when no row was removed. Row Level Security blocks a delete by
// matching zero rows rather than raising an error, so checking `error` alone
// would report success for a load that is still there.
export async function deleteLoad(loadId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('loads')
    .delete()
    .eq('id', loadId)
    .select('id');

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Loads across one owner's drivers only. `ownerId` is the owner's own user id;
// we resolve it to their drivers' ids and filter by driver_id. RLS enforces the
// same boundary server-side.
export async function getFleetLoads(ownerId: string): Promise<Load[]> {
  const driverIds = await getFleetDriverIds(ownerId);
  if (!driverIds.length) return [];
  const { data, error } = await supabase
    .from('loads')
    .select('*, users(full_name)')
    .in('driver_id', driverIds);

  if (error) throw error;
  return (data ?? []).map(rowToLoad);
}
