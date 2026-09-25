import { supabase } from '../../lib/supabase';

export interface MaintenanceItem {
  id: string;
  driver_id: string;
  type: string;
  last_service_date: string;
  last_service_odometer: number;
  due_odometer: number;
  due_date?: string;
  notes?: string;
}

// Reads throw on a query error and return [] / null when there is no data.
// Writes throw on failure so a save that didn't happen never looks like one.

export async function getMaintenanceSchedule(driverId: string): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase
    .from('maintenance_schedule')
    .select('*')
    .eq('driver_id', driverId);

  if (error) throw error;
  return (data ?? []) as MaintenanceItem[];
}

export async function getMaintenanceDueSoon(driverId: string, currentOdometer: number): Promise<MaintenanceItem[]> {
  const schedule = await getMaintenanceSchedule(driverId);
  // Due soon if remaining miles <= 1000
  return schedule.filter((item) => item.due_odometer - currentOdometer <= 1000);
}

export async function logMaintenanceService(serviceRecord: Omit<MaintenanceItem, 'id'>): Promise<MaintenanceItem> {
  const { data, error } = await supabase
    .from('maintenance_schedule')
    .insert([serviceRecord])
    .select()
    .single();

  if (error) throw error;
  return data as MaintenanceItem;
}

// Returns false when the driver has no vehicle row to update: an update that
// matches zero rows raises no error, so this checks what was actually written.
export async function updateOdometer(driverId: string, odometer: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({ current_odometer: odometer })
    .eq('driver_id', driverId)
    .select('driver_id');

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// Null when the driver has no vehicle or reading on file yet.
export async function getOdometer(driverId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('current_odometer')
    .eq('driver_id', driverId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.current_odometer ?? null;
}
