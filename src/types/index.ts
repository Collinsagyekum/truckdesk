// Shared TypeScript types and interfaces

export type UserRole = 'driver' | 'owner';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  company_id?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  fin_intel_addon?: boolean;
  referral_code?: string;
  referral_count?: number;
  referral_credits?: number;
}

export type LoadStatus =
  | 'upcoming'
  | 'active'
  | 'delivered'
  | 'cancelled'
  | 'pending'
  | 'in_transit'
  | 'invoiced'
  | 'paid';

export interface Load {
  id: string;
  driver_id: string;
  broker_name: string;
  origin: string;
  destination: string;
  rate: number;
  miles: number;
  status: LoadStatus;
  pickup_date: string;
  delivery_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  driver_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  receipt_url?: string;
  date: string;
  is_deductible: boolean;
  created_at: string;
  flagged?: boolean;
  flag_reason?: string;
  driver_name?: string;
  // Fuel/IFTA fields — populated by MilesBot for fuel purchases.
  city?: string;
  state?: string;
  gallons?: number;
  ifta_eligible?: boolean;
  vendor?: string;
}

export type ExpenseCategory =
  | 'fuel'
  | 'maintenance'
  | 'tolls'
  | 'toll'
  | 'insurance'
  | 'permits'
  | 'meals'
  | 'food'
  | 'lodging'
  | 'supplies'
  | 'tire'
  | 'scales'
  | 'lumper'
  | 'phone'
  | 'parking'
  | 'other';

export interface ComplianceItem {
  id: string;
  driver_id: string;
  type: string;
  title: string;
  expiry_date: string;
  status: 'valid' | 'expiring_soon' | 'expired';
  document_url?: string;
  score?: number;
  warnings?: string[];
  driver_name?: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  driver_id?: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  license_plate: string;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface Invoice {
  id: string;
  load_id: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  due_date: string;
  paid_date?: string;
  created_at: string;
  client_name?: string;
  driver_name?: string;
  driver_id?: string;
  invoice_number?: string;
}
