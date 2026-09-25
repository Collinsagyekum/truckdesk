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

export async function getFleetDrivers(companyId: string): Promise<User[]> {
  // NOTE: the real `users` table has no company_id column, so we can't scope by
  // company. Single business = every driver belongs to this fleet; RLS is the
  // real security boundary.
  void companyId;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'driver');

  if (error) throw error;
  return (data ?? []) as User[];
}
