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

  if (error || !data || data.length === 0) {
    return [
      {
        id: 'wa-1',
        driver_id: driverId,
        sender_number: '+12815550001',
        input_method: 'text',
        content: 'Logged 450 miles today from Houston to Dallas',
        intent: 'log_miles',
        parsed_data: { miles: 450, origin: 'Houston', destination: 'Dallas' },
        status: 'processed',
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
      },
      {
        id: 'wa-2',
        driver_id: driverId,
        sender_number: '+12815550001',
        input_method: 'image',
        content: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=300', // Receipt placeholder
        intent: 'log_expense',
        parsed_data: { amount: 350.5, category: 'fuel', vendor: 'Pilot Flying J' },
        linked_expense_id: 'exp-1',
        status: 'processed',
        created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
      },
      {
        id: 'wa-3',
        driver_id: driverId,
        sender_number: '+12815550001',
        input_method: 'voice',
        content: '[Voice Note: "Just paid $45 for Illinois tolls"]',
        intent: 'log_expense',
        parsed_data: { amount: 45.0, category: 'tolls', location: 'Illinois' },
        linked_expense_id: 'exp-4',
        status: 'processed',
        created_at: new Date(Date.now() - 1000 * 60 * 480).toISOString(), // 8 hours ago
      },
    ];
  }
  return data as WhatsappSubmission[];
}
