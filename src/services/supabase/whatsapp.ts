import { supabase } from '../../lib/supabase';

export interface WhatsappSubmission {
  id: string;
  driver_id: string;
  sender_number: string;
  input_method: 'text' | 'image' | 'voice';
  content: string; // Text content, image URL, or voice URL
  intent: string; // 'log_expense', 'log_miles', 'status_update', etc.
  parsed_data: Record<string, any>;
  linked_expense_id?: string;
  linked_load_id?: string;
  status: 'pending' | 'processed' | 'failed';
  created_at: string;
}

export async function getWhatsappSubmissions(
  driverId: string,
  limit: number = 20,
  offset: number = 0
): Promise<WhatsappSubmission[]> {
  const { data, error } = await supabase
    .from('whatsapp_submissions')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Throw rather than returning placeholder rows: invented submissions made a
  // failed or empty read look like real activity from the driver's phone.
  if (error) throw error;
  return (data ?? []) as WhatsappSubmission[];
}
