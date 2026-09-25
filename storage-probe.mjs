import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';

const SUPABASE_URL = 'https://ycukpolicbsliuktqpsh.supabase.co';
const envValue = (file, name) => readFileSync(file, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))[1].trim().replace(/^["']|["']$/g, '');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(SUPABASE_URL, envValue('/Users/collinsagyekum/milesbot-server/.env', 'SUPABASE_SERVICE_KEY'), noSession);
const ANON_KEY = envValue('/Users/collinsagyekum/truckdesk/.env.local', 'VITE_SUPABASE_ANON_KEY');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64');

const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
if (bucketError) throw bucketError;
console.log('buckets:', buckets.map((b) => `${b.name} (${b.public ? 'public' : 'private'}, types=${b.allowed_mime_types ?? 'any'})`).join('; '));

const email = `storageprobe-${Date.now()}@numdaanalytics.com`;
const password = randomBytes(12).toString('hex');
const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createError) throw createError;
const uid = created.user.id;
const cleanup = [];

try {
  const user = createClient(SUPABASE_URL, ANON_KEY, noSession);
  const { error: signInError } = await user.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const own = `${uid}/app-upload.png`;
  const { error: upError } = await user.storage.from('receipts').upload(own, PNG, { contentType: 'image/png' });
  console.log(`user uploads to receipts/<uid>/: ${upError ? `DENIED (${upError.message})` : 'allowed'}`);
  if (!upError) cleanup.push(own);

  const botFile = `${uid}/bot-upload.png`;
  await admin.storage.from('receipts').upload(botFile, PNG, { contentType: 'image/png' });
  cleanup.push(botFile);

  const { data: listed, error: listError } = await user.storage.from('receipts').list(uid);
  console.log(`user lists own folder: ${listError ? `DENIED (${listError.message})` : `sees ${listed.length} file(s): ${listed.map((f) => f.name).join(', ')}`}`);

  if (!upError) {
    const { data: signed, error: signError } = await user.storage.from('receipts').createSignedUrl(own, 60);
    console.log(`user creates signed URL for own upload: ${signError ? `DENIED (${signError.message})` : signed?.signedUrl ? 'allowed' : 'no url'}`);
  }

  const { data: removedBot, error: removeBotError } = await user.storage.from('receipts').remove([botFile]);
  console.log(`user deletes MilesBot-uploaded file: ${removeBotError ? `DENIED (${removeBotError.message})` : `${removedBot.length} removed`}`);

  if (!upError) {
    const { data: removedOwn, error: removeOwnError } = await user.storage.from('receipts').remove([own]);
    console.log(`user deletes own upload: ${removeOwnError ? `DENIED (${removeOwnError.message})` : `${removedOwn.length} removed`}`);
  }
} finally {
  if (cleanup.length) await admin.storage.from('receipts').remove(cleanup);
  await admin.auth.admin.deleteUser(uid).catch(() => {});
  console.log('probe user and files cleaned up');
}
