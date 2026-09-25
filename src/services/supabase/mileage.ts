import { supabase } from '../../lib/supabase';

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

export async function getFleetMileage(): Promise<DailyMileage[]> {
  const { data, error } = await supabase
    .from('daily_mileage')
    .select('*')
    .order('log_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DailyMileage[];
}

export async function getWeeklyMileage(driverId: string): Promise<DailyMileage[]> {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const isoStart = startOfWeek.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_mileage')
    .select('*')
    .eq('driver_id', driverId)
    .gte('log_date', isoStart)
    .order('log_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DailyMileage[];
}
