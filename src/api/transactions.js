import api from '../lib/api';

export async function createTransaction({ totalAmountCents, customerId = null, guestEmail = null, isDonation = false, donationId = null, receipt = null, sale_items = null }) {
    return api.post('/transactions', {
        total_amount_cents: totalAmountCents,
        customer_id: customerId,
        guest_email: guestEmail,
        is_donation: isDonation,
        donation_id: donationId,
        receipt,
        sale_items,
    });
}

export const getAdminTransactions   = ()     => api.get('/transactions');
export const getCustomerTransactions = ()    => api.get('/transactions/my');
export const getTransactionById     = (id)   => api.get(`/transactions/${id}`);
export const getDonationTransactions = ()    => api.get('/transactions?is_donation=1');
export const getRecentTransactions  = (n=10) => api.get('/transactions').then(r => r.slice(0, n));

export async function createSaleItems(items) {
    // items: [{ transaction_id, item_id, quantity, price_at_sale_cents }]
    return api.post('/transactions/sale-items', { items });
}

export async function getSaleItemsByTransaction(transactionId) {
    return api.get(`/transactions/${transactionId}/sale-items`);
}

export async function incrementEventTicketsSold(eventId, quantity) {
    // Handled automatically by POST /api/tickets on the server
    return { success: true };
}
