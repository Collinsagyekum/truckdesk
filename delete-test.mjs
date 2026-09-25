import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';

const SUPABASE_URL = 'https://ycukpolicbsliuktqpsh.supabase.co';
const AUTH_KEY = 'sb-ycukpolicbsliuktqpsh-auth-token';
const envValue = (file, name) => {
  const match = readFileSync(file, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) throw new Error(`${name} missing in ${file}`);
  return match[1].trim().replace(/^["']|["']$/g, '');
};
const SERVICE_KEY = envValue('/Users/collinsagyekum/milesbot-server/.env', 'SUPABASE_SERVICE_KEY');
const ANON_KEY = envValue('/Users/collinsagyekum/truckdesk/.env.local', 'VITE_SUPABASE_ANON_KEY');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, SERVICE_KEY, noSession);

const must = async (promise, label) => {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
};
const count = async (table, column, value) => {
  let query = admin.from(table).select('id', { count: 'exact', head: true });
  if (column) query = query.eq(column, value);
  return (await must(query, `count ${table}`)).count;
};

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64');
const today = new Date().toISOString().split('T')[0];

const signedOut = createClient(SUPABASE_URL, ANON_KEY, noSession);
const { error: signedOutError } = await signedOut.rpc('delete_my_account');
console.log(`signed-out call rejected: ${!!signedOutError} (${signedOutError?.message})`);

const totalsBefore = { loads: await count('loads'), expenses: await count('expenses') };

const email = `deletetest-${Date.now()}@numdaanalytics.com`;
const password = randomBytes(12).toString('hex');
const { data: created } = await must(admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create test user');
const uid = created.user.id;

const uploads = [
  { as: 'user (app)', bucket: 'receipts', path: `${uid}/app-receipt.png` },
  { as: 'service (MilesBot path)', bucket: 'receipts', path: `${uid}/milesbot-receipt.png` },
  { as: 'user', bucket: 'compliance-docs', path: `${uid}/license.png` },
];

try {
  await must(admin.from('users').insert({ id: uid, email, full_name: 'Delete Test', role: 'driver' }), 'insert profile');
  const { data: load } = await must(
    admin.from('loads').insert({ driver_id: uid, broker_name: 'Delete Test', origin_city: 'Austin', origin_state: 'TX', destination_city: 'Waco', destination_state: 'TX', miles: 1, rate: 1, status: 'delivered', pickup_date: today }).select('id').single(),
    'insert load',
  );
  await must(admin.from('expenses').insert({ driver_id: uid, load_id: load.id, category: 'toll', amount: 1, expense_date: today }), 'insert expense');

  const user = createClient(SUPABASE_URL, ANON_KEY, noSession);
  const { data: signIn } = await must(user.auth.signInWithPassword({ email, password }), 'sign in test user');

  for (const u of uploads) {
    const client = u.as.startsWith('service') ? admin : user;
    const { error } = await client.storage.from(u.bucket).upload(u.path, PNG, { contentType: 'image/png' });
    u.uploaded = !error;
    console.log(`upload ${u.bucket}/${u.path.replace(uid, '<uid>')} as ${u.as}: ${error ? `FAILED (${error.message})` : 'ok'}`);
  }

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [AUTH_KEY, JSON.stringify(signIn.session)]);
  await page.goto('http://localhost:5173/driver/account', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Delete account")');
  await page.click('button:has-text("Delete my account")');
  await page.waitForURL('**/login', { timeout: 20000 });
  const toastShown = await page.getByText('Your account has been deleted.').waitFor({ timeout: 5000 }).then(() => true, () => false);
  console.log(`UI: back on login screen; success message shown: ${toastShown}`);
  if (consoleErrors.length) console.log(`UI console errors: ${[...new Set(consoleErrors)].join(' | ')}`);
  await browser.close();

  const { data: authLookup } = await admin.auth.admin.getUserById(uid);
  console.log(`auth user deleted: ${!authLookup?.user}`);
  console.log(`profile rows left: ${await count('users', 'id', uid)}`);
  console.log(`load rows left: ${await count('loads', 'driver_id', uid)}, expense rows left: ${await count('expenses', 'driver_id', uid)}`);
  for (const u of uploads.filter((x) => x.uploaded)) {
    const folder = u.path.slice(0, u.path.lastIndexOf('/'));
    const name = u.path.slice(u.path.lastIndexOf('/') + 1);
    const { data } = await admin.storage.from(u.bucket).list(folder);
    console.log(`file ${u.bucket}/${u.path.replace(uid, '<uid>')} removed: ${!(data ?? []).some((f) => f.name === name)}`);
  }
  const totalsAfter = { loads: await count('loads'), expenses: await count('expenses') };
  console.log(`other people's data unchanged: loads ${totalsBefore.loads}->${totalsAfter.loads}, expenses ${totalsBefore.expenses}->${totalsAfter.expenses}`);
} finally {
  const leftovers = uploads.filter((u) => u.uploaded);
  for (const u of leftovers) await admin.storage.from(u.bucket).remove([u.path]);
  await admin.from('expenses').delete().eq('driver_id', uid);
  await admin.from('loads').delete().eq('driver_id', uid);
  await admin.from('users').delete().eq('id', uid);
  await admin.auth.admin.deleteUser(uid).catch(() => {});
}
