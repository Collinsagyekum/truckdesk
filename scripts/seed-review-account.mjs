import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'fs';
import { randomInt } from 'crypto';

const SUPABASE_URL = 'https://ycukpolicbsliuktqpsh.supabase.co';
const EMAIL = 'appreview@numdaanalytics.com';
const CRED_FILE = '/Users/collinsagyekum/Desktop/app-review-login.txt';

const envValue = (file, names) => {
  const text = readFileSync(file, 'utf8');
  for (const name of names) {
    const match = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error(`None of ${names.join(', ')} found in ${file}`);
};
const SERVICE_KEY = envValue('/Users/collinsagyekum/milesbot-server/.env', ['SUPABASE_SERVICE_KEY']);
const ANON_KEY = envValue('/Users/collinsagyekum/truckdesk/.env.local', ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY']);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SERVICE_KEY, noSession);

// Keep the existing code on re-runs so App Store Connect doesn't go stale.
let code = existsSync(CRED_FILE) ? readFileSync(CRED_FILE, 'utf8').match(/Code:\s*(\d{6})/)?.[1] : null;
code ??= String(randomInt(100000, 1000000));

let userId;
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  userId = data.users.find((u) => u.email === EMAIL)?.id;
  if (userId || data.users.length < 1000) break;
}

if (userId) {
  const { error } = await admin.auth.admin.updateUserById(userId, { password: code, email_confirm: true });
  if (error) throw error;
  console.log('review login: updated existing account');
} else {
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: code, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  console.log('review login: created account');
}

writeFileSync(
  CRED_FILE,
  [
    'TruckDesk - App Review demo account (driver)',
    '',
    `Email: ${EMAIL}`,
    `Code: ${code}`,
    '',
    'App Store Connect > App Review Information > Sign-In Information:',
    `  User name: ${EMAIL}`,
    `  Password: ${code}`,
    '',
  ].join('\n'),
);
chmodSync(CRED_FILE, 0o600);

const { error: profileError } = await admin
  .from('users')
  .upsert({ id: userId, email: EMAIL, full_name: 'Demo Driver', role: 'driver' }, { onConflict: 'id' });
if (profileError) throw profileError;

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];

for (const table of ['expenses', 'loads']) {
  const { error } = await admin.from(table).delete().eq('driver_id', userId);
  if (error) throw error;
}

const loads = [
  { broker_name: 'Lone Star Freight', origin_city: 'Dallas', origin_state: 'TX', destination_city: 'Houston', destination_state: 'TX', miles: 239, rate: 1450, status: 'delivered', trailer_type: 'dry_van', pickup_date: day(-2), delivery_date: day(-1) },
  { broker_name: 'Gulf Coast Brokerage', origin_city: 'Houston', origin_state: 'TX', destination_city: 'San Antonio', destination_state: 'TX', miles: 197, rate: 980, status: 'delivered', trailer_type: 'dry_van', pickup_date: day(-1), delivery_date: day(0) },
  { broker_name: 'Heartland Logistics', origin_city: 'San Antonio', origin_state: 'TX', destination_city: 'Phoenix', destination_state: 'AZ', miles: 986, rate: 2850, status: 'active', trailer_type: 'reefer', pickup_date: day(0) },
  { broker_name: 'Blue Ridge Transport', origin_city: 'Phoenix', origin_state: 'AZ', destination_city: 'Los Angeles', destination_state: 'CA', miles: 372, rate: 1300, status: 'upcoming', trailer_type: 'dry_van', pickup_date: day(2) },
].map((l) => ({ ...l, driver_id: userId }));

const expenses = [
  { category: 'fuel', amount: 412.35, vendor: 'Pilot Travel Center', city: 'Dallas', state: 'TX', gallons: 102.4, expense_date: day(-2), notes: 'Diesel fill-up', ifta_eligible: true, tax_deductible: true },
  { category: 'toll', amount: 18.5, vendor: 'NTTA', city: 'Dallas', state: 'TX', expense_date: day(-2), notes: 'Dallas North Tollway', tax_deductible: true },
  { category: 'food', amount: 23.8, vendor: "Love's Travel Stop", city: 'Houston', state: 'TX', expense_date: day(-1), notes: 'Dinner on the road', tax_deductible: true },
  { category: 'fuel', amount: 389.1, vendor: "Love's Travel Stop", city: 'San Antonio', state: 'TX', gallons: 96.7, expense_date: day(0), notes: 'Diesel fill-up', ifta_eligible: true, tax_deductible: true },
  { category: 'scales', amount: 14, vendor: 'CAT Scale', city: 'San Antonio', state: 'TX', expense_date: day(0), notes: 'Weigh ticket', tax_deductible: true },
].map((e) => ({ ...e, driver_id: userId }));

for (const [table, rows] of [['loads', loads], ['expenses', expenses]]) {
  const { error } = await admin.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}
console.log(`seeded ${loads.length} loads, ${expenses.length} expenses`);

// Prove the code works through the normal client, and that RLS shows this driver their own data.
const client = createClient(SUPABASE_URL, ANON_KEY, noSession);
const { error: signInError } = await client.auth.signInWithPassword({ email: EMAIL, password: code });
if (signInError) throw new Error(`sign-in with code failed: ${signInError.message}`);
const { data: profile } = await client.from('users').select('role, full_name').eq('id', userId).single();
const { count: loadCount } = await client.from('loads').select('id', { count: 'exact', head: true }).eq('driver_id', userId);
const { count: expenseCount } = await client.from('expenses').select('id', { count: 'exact', head: true }).eq('driver_id', userId);
console.log(`signed in as ${profile?.full_name} (${profile?.role}); sees ${loadCount} loads, ${expenseCount} expenses`);
console.log('code saved to ~/Desktop/app-review-login.txt');
