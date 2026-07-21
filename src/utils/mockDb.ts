import type { User, Load, Expense, ComplianceItem, Invoice } from '../types';

// In-memory data store for local development / preview fallbacks
let driversList: User[] = [
  {
    id: 'mock-driver-id',
    full_name: 'Alex Driver',
    email: 'alex@truckdesk.com',
    phone: '+12815550001',
    role: 'driver',
    company_id: 'company-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    fin_intel_addon: true,
  },
  {
    id: 'driver-john',
    full_name: 'John Doe',
    email: 'john@truckdesk.com',
    phone: '+12815550002',
    role: 'driver',
    company_id: 'company-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    fin_intel_addon: false,
  },
  {
    id: 'driver-marcus',
    full_name: 'Marcus Miller',
    email: 'marcus@truckdesk.com',
    phone: '+12815550003',
    role: 'driver',
    company_id: 'company-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    fin_intel_addon: true,
  },
  {
    id: 'driver-david',
    full_name: 'David Vance',
    email: 'david@truckdesk.com',
    phone: '+12815550004',
    role: 'driver',
    company_id: 'company-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    fin_intel_addon: false,
  },
];

let loadsList: Load[] = [
  // Alex Driver loads
  {
    id: 'load-1',
    driver_id: 'mock-driver-id',
    broker_name: 'C.H. Robinson',
    origin: 'Houston, TX',
    destination: 'Dallas, TX',
    rate: 1250,
    miles: 240,
    status: 'delivered',
    pickup_date: '2026-05-25',
    delivery_date: '2026-05-26',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'load-2',
    driver_id: 'mock-driver-id',
    broker_name: 'TQL',
    origin: 'Atlanta, GA',
    destination: 'Charlotte, NC',
    rate: 950,
    miles: 245,
    status: 'active',
    pickup_date: '2026-05-28',
    delivery_date: '2026-05-29',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'load-3',
    driver_id: 'mock-driver-id',
    broker_name: 'Landstar',
    origin: 'Chicago, IL',
    destination: 'Indianapolis, IN',
    rate: 800,
    miles: 185,
    status: 'upcoming',
    pickup_date: '2026-06-01',
    delivery_date: '2026-06-02',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // John Doe loads
  {
    id: 'load-john-1',
    driver_id: 'driver-john',
    broker_name: 'TQL',
    origin: 'Nashville, TN',
    destination: 'Memphis, TN',
    rate: 1100,
    miles: 210,
    status: 'delivered',
    pickup_date: '2026-05-24',
    delivery_date: '2026-05-25',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'load-john-2',
    driver_id: 'driver-john',
    broker_name: 'C.H. Robinson',
    origin: 'Memphis, TN',
    destination: 'Little Rock, AR',
    rate: 850,
    miles: 135,
    status: 'active',
    pickup_date: '2026-05-27',
    delivery_date: '2026-05-28',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Marcus Miller loads
  {
    id: 'load-marcus-1',
    driver_id: 'driver-marcus',
    broker_name: 'J.B. Hunt',
    origin: 'St. Louis, MO',
    destination: 'Kansas City, MO',
    rate: 1400,
    miles: 250,
    status: 'delivered',
    pickup_date: '2026-05-20',
    delivery_date: '2026-05-21',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // David Vance loads
  {
    id: 'load-david-1',
    driver_id: 'driver-david',
    broker_name: 'Echo Global',
    origin: 'Columbus, OH',
    destination: 'Pittsburgh, PA',
    rate: 750,
    miles: 185,
    status: 'delivered',
    pickup_date: '2026-05-26',
    delivery_date: '2026-05-27',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'load-david-2',
    driver_id: 'driver-david',
    broker_name: 'Landstar',
    origin: 'Pittsburgh, PA',
    destination: 'Philadelphia, PA',
    rate: 1600,
    miles: 305,
    status: 'active',
    pickup_date: '2026-05-28',
    delivery_date: '2026-05-29',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let expensesList: Expense[] = [
  // Alex Driver expenses
  {
    id: 'exp-1',
    driver_id: 'mock-driver-id',
    category: 'fuel',
    amount: 350.5,
    description: 'Pilot Flying J - 92 Gallons Diesel',
    date: '2026-05-27',
    is_deductible: true,
    created_at: new Date().toISOString(),
    flagged: false,
    driver_name: 'Alex Driver',
  },
  {
    id: 'exp-2',
    driver_id: 'mock-driver-id',
    category: 'maintenance',
    amount: 120.0,
    description: 'Speedco - Tractor Lube & Inspection',
    date: '2026-05-24',
    is_deductible: true,
    created_at: new Date().toISOString(),
    flagged: false,
    driver_name: 'Alex Driver',
  },
  // Marcus Miller expenses (with a flagged one)
  {
    id: 'exp-marcus-1',
    driver_id: 'driver-marcus',
    category: 'meals',
    amount: 120.0,
    description: 'Ruths Chris Steakhouse dinner',
    date: '2026-05-27',
    is_deductible: true,
    created_at: new Date().toISOString(),
    flagged: true,
    flag_reason: 'Meal expense exceeds the standard $60 daily driver limit.',
    driver_name: 'Marcus Miller',
  },
  // David Vance expenses (with a flagged one)
  {
    id: 'exp-david-1',
    driver_id: 'driver-david',
    category: 'fuel',
    amount: 450.0,
    description: 'Love Travel Stop - Fueling & AdBlue',
    date: '2026-05-26',
    is_deductible: true,
    created_at: new Date().toISOString(),
    flagged: true,
    flag_reason: 'Odometer reading gap suggests fuel purchase was done outside authorized route.',
    driver_name: 'David Vance',
  },
  {
    id: 'exp-david-2',
    driver_id: 'driver-david',
    category: 'tolls',
    amount: 32.5,
    description: 'PA Turnpike Tolls',
    date: '2026-05-28',
    is_deductible: true,
    created_at: new Date().toISOString(),
    flagged: false,
    driver_name: 'David Vance',
  },
];

let complianceList: ComplianceItem[] = [
  {
    id: 'comp-alex-1',
    driver_id: 'mock-driver-id',
    type: 'CDL',
    title: 'Commercial Driver License',
    expiry_date: '2028-11-14',
    status: 'valid',
    score: 98,
    driver_name: 'Alex Driver',
  },
  {
    id: 'comp-alex-2',
    driver_id: 'mock-driver-id',
    type: 'Medical',
    title: 'DOT Medical Card',
    expiry_date: '2027-02-15',
    status: 'valid',
    score: 98,
    driver_name: 'Alex Driver',
  },
  {
    id: 'comp-john-1',
    driver_id: 'driver-john',
    type: 'CDL',
    title: 'Commercial Driver License',
    expiry_date: '2026-09-10',
    status: 'valid',
    score: 92,
    driver_name: 'John Doe',
  },
  {
    id: 'comp-john-2',
    driver_id: 'driver-john',
    type: 'Medical',
    title: 'DOT Medical Card',
    expiry_date: '2026-06-12',
    status: 'expiring_soon',
    score: 92,
    driver_name: 'John Doe',
  },
  {
    id: 'comp-marcus-1',
    driver_id: 'driver-marcus',
    type: 'CDL',
    title: 'Commercial Driver License',
    expiry_date: '2029-01-25',
    status: 'valid',
    score: 65,
    driver_name: 'Marcus Miller',
  },
  {
    id: 'comp-marcus-2',
    driver_id: 'driver-marcus',
    type: 'Medical',
    title: 'DOT Medical Card',
    expiry_date: '2026-05-24', // Expired!
    status: 'expired',
    score: 65,
    driver_name: 'Marcus Miller',
    warnings: ['Medical certificate expired on 2026-05-24.'],
  },
  {
    id: 'comp-david-1',
    driver_id: 'driver-david',
    type: 'CDL',
    title: 'Commercial Driver License',
    expiry_date: '2026-06-03', // CDL expiring in 5 days
    status: 'expiring_soon',
    score: 78,
    driver_name: 'David Vance',
    warnings: ['CDL expires in less than 7 days.'],
  },
];

let invoicesList: Invoice[] = [
  {
    id: 'inv-1',
    load_id: 'load-1',
    amount: 1250,
    status: 'paid',
    due_date: '2026-06-05',
    paid_date: '2026-05-27',
    created_at: new Date().toISOString(),
    client_name: 'C.H. Robinson',
    driver_name: 'Alex Driver',
    driver_id: 'mock-driver-id',
    invoice_number: 'INV-2026-001',
  },
  {
    id: 'inv-2',
    load_id: 'load-john-1',
    amount: 1100,
    status: 'sent',
    due_date: '2026-06-10',
    created_at: new Date().toISOString(),
    client_name: 'TQL',
    driver_name: 'John Doe',
    driver_id: 'driver-john',
    invoice_number: 'INV-2026-002',
  },
  {
    id: 'inv-3',
    load_id: 'load-david-1',
    amount: 750,
    status: 'overdue',
    due_date: '2026-05-20',
    created_at: new Date().toISOString(),
    client_name: 'Echo Global',
    driver_name: 'David Vance',
    driver_id: 'driver-david',
    invoice_number: 'INV-2026-003',
  },
  {
    id: 'inv-4',
    load_id: 'load-marcus-1',
    amount: 1400,
    status: 'paid',
    due_date: '2026-06-02',
    paid_date: '2026-05-26',
    created_at: new Date().toISOString(),
    client_name: 'J.B. Hunt',
    driver_name: 'Marcus Miller',
    driver_id: 'driver-marcus',
    invoice_number: 'INV-2026-004',
  },
];

// Helper methods to interact with in-memory DB
export const mockDb = {
  getDrivers: () => driversList,
  getLoads: () => loadsList,
  getExpenses: () => expensesList,
  getCompliance: () => complianceList,
  getInvoices: () => invoicesList,

  getDriverDetails: (driverId: string) => {
    return driversList.find((d) => d.id === driverId) || null;
  },

  getDriverLoads: (driverId: string) => {
    return loadsList.filter((l) => l.driver_id === driverId);
  },

  getDriverExpenses: (driverId: string) => {
    return expensesList.filter((e) => e.driver_id === driverId);
  },

  getDriverCompliance: (driverId: string) => {
    return complianceList.filter((c) => c.driver_id === driverId);
  },

  updateExpense: (expenseId: string, updates: Partial<Expense>) => {
    expensesList = expensesList.map((exp) => {
      if (exp.id === expenseId) {
        return { ...exp, ...updates };
      }
      return exp;
    });
    return expensesList.find((exp) => exp.id === expenseId) || null;
  },

  updateInvoiceStatus: (invoiceId: string, status: 'draft' | 'sent' | 'paid' | 'overdue') => {
    invoicesList = invoicesList.map((inv) => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status,
          paid_date: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
        };
      }
      return inv;
    });
    return invoicesList.find((inv) => inv.id === invoiceId) || null;
  },

  createInvoice: (invoiceData: Omit<Invoice, 'id' | 'created_at'>) => {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      invoice_number: `INV-2026-00${invoicesList.length + 1}`,
    };
    invoicesList.unshift(newInvoice);
    return newInvoice;
  },
  
  createExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => {
    const driver = driversList.find(d => d.id === expense.driver_id);
    const newExpense: Expense = {
      ...expense,
      id: `exp-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      driver_name: driver ? driver.full_name : 'Unknown Driver'
    };
    expensesList.unshift(newExpense);
    return newExpense;
  },

  createLoad: (load: Omit<Load, 'id' | 'created_at' | 'updated_at'>) => {
    const newLoad: Load = {
      ...load,
      id: `load-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    loadsList.unshift(newLoad);
    return newLoad;
  }
};
