import { supabase } from '../../lib/supabase';
import { getFleetDriverIds } from './users';

export interface DailyMileage {
  id: string;
  driver_id: string;
  log_date: string;
  miles: number | null;
  notes: string | null;
  created_at: string;
}

// Throw on a query error rather than returning [], so a failed load can't pass
// for "no miles logged".

export async function getDailyMileage(driverId: string): Promise<DailyMileage[]> {
  const { data, error } = await supabase
    .from('daily_mileage')
    .select('*')
    .eq('driver_id', driverId)
    .order('log_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DailyMileage[];
}

// Daily mileage across one owner's drivers only. RLS enforces the same boundary.
export async function getFleetMileage(ownerId: string): Promise<DailyMileage[]> {
  const driverIds = await getFleetDriverIds(ownerId);
  if (!driverIds.length) return [];
  const { data, error } = await supabase
    .from('daily_mileage')
    .select('*')
    .in('driver_id', driverIds)
    .order('log_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DailyMileage[];
}

export async function getWeeklyMileage(driverId: string): Promise<DailyMileage[]> {
  // Rolling last-7-days window (today + the previous 6 days), matching
  // getWeeklyLoads, so Home miles don't reset on Sunday.
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  const isoStart = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_mileage')
    .select('*')
    .eq('driver_id', driverId)
    .gte('log_date', isoStart)
    .order('log_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DailyMileage[];
}
