import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

export async function createDonation(payload) {
  const result = await supabase
    .from('donations')
    .insert([payload])
    .select()
    .single();

  return handleSupabaseResult(result, null);
}