import { supabase } from '../lib/supabase';
import { handleSupabaseResult, sumCents } from '../utils/apiHandler';

export async function getAdminDashboardStats() {
  const [
    animalsRes,
    staffRes,
    customersRes,
    inventoryRes,
    eventsRes,
    transactionsRes,
  ] = await Promise.all([
    supabase.from('animals').select('*', { count: 'exact', head: true }),
    supabase.from('employees').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('inventory_items').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('transactions').select('total_amount_cents'),
  ]);

  if (animalsRes.error) throw animalsRes.error;
  if (staffRes.error) throw staffRes.error;
  if (customersRes.error) throw customersRes.error;
  if (inventoryRes.error) throw inventoryRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const transactions = handleSupabaseResult(transactionsRes);
  const totalRevenueCents = sumCents(transactions, 'total_amount_cents');

  return {
    animals: animalsRes.count ?? 0,
    staff: staffRes.count ?? 0,
    customers: customersRes.count ?? 0,
    inventory: inventoryRes.count ?? 0,
    events: eventsRes.count ?? 0,
    totalRevenueCents,
  };
}