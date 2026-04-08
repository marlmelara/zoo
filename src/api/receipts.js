import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

/**
 * Generate and store a receipt for a transaction.
 * In a production app this would trigger an email via an edge function or
 * third-party service. For this project we persist the receipt data so
 * customers can view / re-send from their dashboard.
 */
export async function createReceipt({
  transactionId,
  email,
  customerName,
  items = [],      // [{ description, quantity, unitPriceCents }]
  subtotalCents,
  taxCents,
  totalCents,
  isDonation = false,
  donationFund = null,
}) {
  const result = await supabase
    .from('receipts')
    .insert([{
      transaction_id: transactionId,
      email,
      customer_name: customerName,
      line_items: items,
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      is_donation: isDonation,
      donation_fund: donationFund,
    }])
    .select()
    .single();

  return handleSupabaseResult(result, null);
}

/* ── Fetch receipts for a customer email ── */
export async function getReceiptsByEmail(email) {
  const result = await supabase
    .from('receipts')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false });

  return handleSupabaseResult(result);
}

/* ── Fetch a single receipt by transaction id ── */
export async function getReceiptByTransaction(transactionId) {
  const result = await supabase
    .from('receipts')
    .select('*')
    .eq('transaction_id', transactionId)
    .single();

  return handleSupabaseResult(result, null);
}
