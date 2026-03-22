import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

export async function getAdminTickets() {
  const result = await supabase
    .from('tickets')
    .select('*')
    .order('ticket_id', { ascending: true });

  return handleSupabaseResult(result);
}

export async function getPublicTicketTypes() {
  return [
    {
      id: 'general',
      title: 'General Admission',
      description: 'Standard zoo entry for one guest.',
      price: 24.99,
    },
    {
      id: 'child',
      title: 'Child Admission',
      description: 'Discounted entry for children.',
      price: 17.99,
    },
    {
      id: 'membership',
      title: 'Membership',
      description: 'Unlimited visits plus exclusive benefits.',
      price: 89.99,
    },
    {
      id: 'vip',
      title: 'VIP Experience',
      description: 'Premium access and special exhibit perks.',
      price: 149.99,
    },
  ];
}