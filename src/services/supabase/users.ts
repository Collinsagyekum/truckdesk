import { supabase } from '../../lib/supabase';
import type { User } from '../../types';

// Null when no profile exists for this id.
export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as User | null) ?? null;
}

export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

// The drivers that belong to one owner. Scoped by `users.owner_id` === the
// owner's own id, which is the real multi-tenancy boundary (RLS enforces the
// same rule server-side). `ownerId` is the owner's own user id.
export async function getFleetDrivers(ownerId: string): Promise<User[]> {
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('role', 'driver');

  if (error) throw error;
  return (data ?? []) as User[];
}

// Just the ids of this owner's drivers — used to scope fleet-wide reads on the
// child tables (loads, expenses, invoices, mileage), which link via driver_id.
export async function getFleetDriverIds(ownerId: string): Promise<string[]> {
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('role', 'driver');

  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}
