import { supabase } from '../../lib/supabase';

// A driver's compliance document (CDL, medical card, insurance, etc.).
export interface ComplianceDoc {
  id: string;
  type: string;
  title: string;
  expiry_date: string;   // '' if not yet provided
  document_url?: string;  // signed URL to the stored scan
  fileName?: string;
  doc_number?: string;
  notes?: string;
}

// The standard slots every driver sees, so they always have a card to fill in
// even before they've entered anything. Real rows from the DB overlay these by
// type; any extra types the driver adds are appended.
export const DEFAULT_COMPLIANCE_SLOTS: ComplianceDoc[] = [
  { id: 'slot-cdl', type: 'CDL', title: "Commercial Driver's License", expiry_date: '' },
  { id: 'slot-medical', type: 'DOT Medical Card', title: "DOT Medical Examiner's Certificate", expiry_date: '' },
  { id: 'slot-insurance', type: 'Vehicle Insurance', title: 'Commercial Auto Liability Insurance', expiry_date: '' },
  { id: 'slot-registration', type: 'Registration', title: 'Cab Card & Apportioned Registration', expiry_date: '' },
];

// Whole days from today until an expiry date: negative once expired, null when
// there's no usable date. Date-only strings are read at noon, because
// new Date('2026-09-01') is UTC midnight — still Aug 31 in US time zones.
// Shared by the driver's and the owner's compliance views so they agree.
export function daysUntilExpiry(expiryDate: string): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ? `${expiryDate}T12:00:00` : expiryDate);
  if (isNaN(expiry.getTime())) return null;
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export type ComplianceStatus = 'clear' | 'attention' | 'critical';

export interface ComplianceSummary {
  status: ComplianceStatus;
  expired: string[];
  expiringSoon: string[];
  missing: string[];
}

// A driver's overall standing from their documents: anything expired is
// critical; anything missing or expiring within 30 days needs attention.
export function summarizeCompliance(docs: ComplianceDoc[]): ComplianceSummary {
  const expired: string[] = [];
  const expiringSoon: string[] = [];
  const missing: string[] = [];
  for (const doc of docs) {
    const days = daysUntilExpiry(doc.expiry_date);
    if (days == null) missing.push(doc.type);
    else if (days < 0) expired.push(doc.type);
    else if (days < 30) expiringSoon.push(doc.type);
  }
  const status: ComplianceStatus = expired.length
    ? 'critical'
    : expiringSoon.length || missing.length
    ? 'attention'
    : 'clear';
  return { status, expired, expiringSoon, missing };
}

function rowToDoc(row: any): ComplianceDoc {
  return {
    id: row.id,
    type: row.type,
    title: row.title ?? row.type,
    expiry_date: row.expiry_date ?? '',
    document_url: row.document_url ?? undefined,
    doc_number: row.doc_number ?? undefined,
    notes: row.notes ?? undefined,
  };
}

// Returns the standard slots overlaid with the driver's real rows (by type).
// Throws if the read fails: falling back to the empty slots would tell a
// driver they have nothing on file when their documents just didn't load.
export async function getComplianceDocs(driverId: string): Promise<ComplianceDoc[]> {
  const slots = DEFAULT_COMPLIANCE_SLOTS.map((s) => ({ ...s }));

  const { data, error } = await supabase
    .from('compliance')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? []).map(rowToDoc);
  const byType = new Map(rows.map((r) => [r.type, r]));
  const merged = slots.map((s) => byType.get(s.type) ?? s);
  // Append any driver-added types that aren't one of the standard slots.
  for (const r of rows) {
    if (!slots.some((s) => s.type === r.type)) merged.push(r);
  }
  return merged;
}

const DOC_URL_TTL = 60 * 60 * 24 * 365; // 1 year

async function uploadScan(driverId: string, type: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'pdf';
  const safeType = type.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const path = `${driverId}/${safeType}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('compliance-docs')
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;

  const { data, error: signErr } = await supabase.storage
    .from('compliance-docs')
    .createSignedUrl(path, DOC_URL_TTL);
  if (signErr) throw signErr;
  if (!data?.signedUrl) throw new Error('Could not get a link to the uploaded scan.');
  return data.signedUrl;
}

// Upsert one document (one row per driver+type). Uploads the scan first if a
// file is provided, and throws if either step fails — a scan that didn't
// upload must not leave behind a record that looks complete.
export async function saveComplianceDoc(
  driverId: string,
  doc: { type: string; title: string; expiry_date: string; doc_number?: string; notes?: string },
  file?: File | null
): Promise<ComplianceDoc> {
  const document_url = file ? await uploadScan(driverId, doc.type, file) : undefined;

  const row: Record<string, any> = {
    driver_id: driverId,
    type: doc.type,
    title: doc.title,
    expiry_date: doc.expiry_date || null,
    doc_number: doc.doc_number || null,
    notes: doc.notes || null,
  };
  if (document_url) row.document_url = document_url;

  const { data, error } = await supabase
    .from('compliance')
    .upsert(row, { onConflict: 'driver_id,type' })
    .select()
    .single();

  if (error) throw error;
  return rowToDoc(data);
}
