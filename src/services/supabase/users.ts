import { supabase } from '../../lib/supabase';
import type { User } from '../../types';
import { mockDb } from '../../utils/mockDb';
import { warnMockFallback } from '../../utils/devWarn';

export async function getUserProfile(userId: string): Promise<User | null> {
  // If in mock environment, check the mock DB first
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getDriverDetails(userId) || mockDb.getDrivers()[0];
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return mockDb.getDriverDetails(userId) || {
      id: userId,
      full_name: 'Alex Driver',
      email: 'alex@truckdesk.com',
      phone: '+12815550001',
      role: 'driver',
      company_id: 'company-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return data as User;
}

export async function updateUserProfile(userId: string, updates: Partial<User>) {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    // Modify in-memory
    const drivers = mockDb.getDrivers();
    const driverIdx = drivers.findIndex((d) => d.id === userId);
    if (driverIdx !== -1) {
      drivers[driverIdx] = { ...drivers[driverIdx], ...updates };
      return { data: drivers[driverIdx], error: null };
    }
    return { data: null, error: new Error('User not found') };
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

export async function getFleetDrivers(companyId: string): Promise<User[]> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return mockDb.getDrivers().filter((d) => d.company_id === companyId);
  }

  // NOTE: the real `users` table has no company_id column, so filtering by it
  // always errored and fell back to demo drivers. Single business = every
  // driver belongs to this fleet; RLS is the real security boundary.
  void companyId;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'driver');

  if (error || !data || data.length === 0) {
    warnMockFallback('getFleetDrivers', error);
    return mockDb.getDrivers();
  }

  return data as User[];
}
