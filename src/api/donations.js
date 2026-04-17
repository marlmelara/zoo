import api from '../lib/api';

export async function createDonation({ donor_name, amount_cents, customer_id = null }) {
    return api.post('/donations', { donor_name, amount_cents, customer_id });
}

export const getMyDonations   = ()  => api.get('/donations/my');
export const getAdminDonations = () => api.get('/donations');
