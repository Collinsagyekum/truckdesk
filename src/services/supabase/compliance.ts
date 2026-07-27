import { supabase } from '../../lib/supabase';
import { warnMockFallback } from '../../utils/devWarn';

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
export async function getComplianceDocs(driverId: string): Promise<ComplianceDoc[]> {
  const slots = DEFAULT_COMPLIANCE_SLOTS.map((s) => ({ ...s }));

  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return slots;
  }

  const { data, error } = await supabase
    .from('compliance')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) {
    warnMockFallback('getComplianceDocs', error);
    return slots;
  }

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

async function uploadScan(driverId: string, type: string, file: File): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'pdf';
    const safeType = type.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const path = `${driverId}/${safeType}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('compliance-docs')
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) {
      console.error('Compliance scan upload error:', error.message);
      return null;
    }
    const { data, error: signErr } = await supabase.storage
      .from('compliance-docs')
      .createSignedUrl(path, DOC_URL_TTL);
    if (signErr) {
      console.error('Compliance scan signed URL error:', signErr.message);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (e: any) {
    console.error('Compliance scan upload threw:', e.message);
    return null;
  }
}

// Upsert one document (one row per driver+type). Uploads the scan first if a
// file is provided. Returns the saved doc, or null if it couldn't persist.
export async function saveComplianceDoc(
  driverId: string,
  doc: { type: string; title: string; expiry_date: string; doc_number?: string; notes?: string },
  file?: File | null
): Promise<ComplianceDoc | null> {
  if (import.meta.env.VITE_SUPABASE_URL === 'your_url_here' || !import.meta.env.VITE_SUPABASE_URL) {
    return null;
  }

  let document_url: string | undefined;
  if (file) {
    const url = await uploadScan(driverId, doc.type, file);
    if (url) document_url = url;
  }

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

  if (error || !data) {
    console.error('Compliance save error:', error?.message);
    return null;
  }
  return rowToDoc(data);
}
