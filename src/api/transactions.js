import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

/* ── Create a transaction ── */
export async function createTransaction({ totalAmountCents, customerId = null, guestEmail = null, isDonation = false, donationId = null }) {
  const result = await supabase
    .from('transactions')
    .insert([{
      total_amount_cents: totalAmountCents,
      customer_id: customerId,
      guest_email: guestEmail,
      is_donation: isDonation,
      donation_id: donationId,
    }])
    .select()
    .single();

  return handleSupabaseResult(result, null);
}

/* ── Get all transactions (admin) ── */
export async function getAdminTransactions() {
  const result = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  return handleSupabaseResult(result);
}

/* ── Get transactions for a specific customer ── */
export async function getCustomerTransactions(customerId) {
  const result = await supabase
    .from('transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('transaction_date', { ascending: false });

  return handleSupabaseResult(result);
}

/* ── Get a single transaction by ID ── */
export async function getTransactionById(transactionId) {
  const result = await supabase
    .from('transactions')
    .select('*')
    .eq('transaction_id', transactionId)
    .single();

  return handleSupabaseResult(result, null);
}

/* ── Create sale items for a transaction ── */
export async function createSaleItems(items) {
  // items: [{ transaction_id, item_id, quantity, price_at_sale_cents }]
  const result = await supabase
    .from('sale_items')
    .insert(items)
    .select();

  return handleSupabaseResult(result);
}

/* ── Get sale items for a transaction ── */
export async function getSaleItemsByTransaction(transactionId) {
  const result = await supabase
    .from('sale_items')
    .select(`
      sale_item_id,
      quantity,
      price_at_sale_cents,
      inventory (
        item_id,
        item_name,
        category
      )
    `)
    .eq('transaction_id', transactionId);

  return handleSupabaseResult(result);
}

/* ── Get donation transactions ── */
export async function getDonationTransactions() {
  const result = await supabase
    .from('transactions')
    .select('*')
    .eq('is_donation', true)
    .order('transaction_date', { ascending: false });

  return handleSupabaseResult(result);
}

/* ── Get recent transactions (for dashboard widgets) ── */
export async function getRecentTransactions(limit = 10) {
  const result = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(limit);

  return handleSupabaseResult(result);
}

/* ── Update tickets sold for an event ── */
export async function incrementEventTicketsSold(eventId, quantity) {
  // First, get the current event data
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('tickets_sold, max_capacity')
    .eq('event_id', eventId)
    .single();

  if (fetchError) return handleSupabaseResult({ error: fetchError }, null);

  const newTicketsSold = (event.tickets_sold || 0) + quantity;

  // Check if we're exceeding capacity
  if (event.max_capacity && newTicketsSold > event.max_capacity) {
    return handleSupabaseResult({ 
      error: { message: `Cannot sell more than ${event.max_capacity} tickets for this event` } 
    }, null);
  }

  // Update the tickets_sold count
  const result = await supabase
    .from('events')
    .update({ tickets_sold: newTicketsSold })
    .eq('event_id', eventId);

  return handleSupabaseResult(result);
}