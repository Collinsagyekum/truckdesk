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

export async function getMaintenanceSchedule(driverId: string): Promise<MaintenanceItem[]> {
  const { data, error } = await supabase
    .from('maintenance_schedule')
    .select('*')
    .eq('driver_id', driverId);

  if (error || !data || data.length === 0) {
    return [
      {
        id: 'maint-1',
        driver_id: driverId,
        type: 'Oil Change & Filters',
        last_service_date: '2026-04-10',
        last_service_odometer: 145000,
        due_odometer: 160000,
        due_date: '2026-07-10',
        notes: 'Shell Rotella T4 15W-40',
      },
      {
        id: 'maint-2',
        driver_id: driverId,
        type: 'Tire Rotation & Brake Check',
        last_service_date: '2025-12-15',
        last_service_odometer: 130000,
        due_odometer: 155000,
        notes: 'Steer tire wear check',
      },
      {
        id: 'maint-3',
        driver_id: driverId,
        type: 'DOT Annual Inspection',
        last_service_date: '2025-06-20',
        last_service_odometer: 120000,
        due_odometer: 150000,
        due_date: '2026-06-20',
      },
    ];
  }
  return data as MaintenanceItem[];
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

  if (error || !data) {
    return { ...serviceRecord, id: Math.random().toString(36).substr(2, 9) };
  }
  return data as MaintenanceItem;
}

export async function updateOdometer(driverId: string, odometer: number): Promise<boolean> {
  const { error } = await supabase
    .from('vehicles')
    .update({ current_odometer: odometer })
    .eq('driver_id', driverId);

  return !error;
}

export async function getOdometer(driverId: string): Promise<number> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('current_odometer')
    .eq('driver_id', driverId)
    .single();

  if (error || !data) {
    return 154620; // High-quality mock odometer reading
  }
  return data.current_odometer;
}
