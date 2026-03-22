import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

export async function getInventoryItems() {
  const result = await supabase
    .from('inventory_items')
    .select('*')
    .order('item_id', { ascending: true });

  return handleSupabaseResult(result);
}

export async function getShopItems() {
  const result = await supabase
    .from('inventory_items')
    .select('*')
    .gt('stock_count', 0)
    .order('item_id', { ascending: true });

  return handleSupabaseResult(result);
}