import api from '../lib/api';

/**
 * Receipt creation is now done atomically inside POST /api/transactions.
 * These helpers remain for any direct receipt lookups needed by components.
 */
export async function createReceipt({
    transactionId, email, customerName, items = [],
    subtotalCents, taxCents, totalCents, isDonation = false, donationFund = null,
}) {
    // This is now handled server-side inside createTransaction.
    // Kept as a no-op to avoid breaking any callers that still reference it.
    console.warn('createReceipt: receipts are now created inside createTransaction on the server.');
    return null;
}

export const getReceiptsByEmail      = (email) => api.get(`/receipts?email=${encodeURIComponent(email)}`);
export const getReceiptByTransaction = (txnId) => api.get(`/receipts/transaction/${txnId}`);
