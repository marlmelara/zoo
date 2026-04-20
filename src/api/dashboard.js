import api from '../lib/api';

export const ROLE_DEPT_MAP = {
    admin:     'Administration',
    manager:   null,
    vet:       'Veterinary Services',
    caretaker: 'Animal Care',
    security:  'Security',
    retail:    'Retail & Operations',
};

// Optional { from, to } narrows every revenue figure to that window so the
// Admin panel can slice by YTD / quarter / year. Counts (staff, animals,
// customers) are returned lifetime regardless.
export const getAdminDashboardStats     = async ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to)   params.set('to',   to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const s = await api.get(`/dashboard/stats${qs}`);
    return {
        totalRevenueCents:   s.total_revenue   || 0,
        ticketRevenueCents:  s.ticket_revenue  || 0,
        retailRevenueCents:  s.retail_revenue  || 0,
        donationRevenueCents: s.total_donations || 0,
        totalEmployees:      s.total_employees || 0,
        totalAnimals:        s.total_animals   || 0,
        totalCustomers:      s.total_customers || 0,
    };
};
export const getEmployeesWithDepartments = () => api.get('/employees');
export const getDepartments             = () => api.get('/employees/departments/all');
export const getAnimalsWithZones        = () => api.get('/animals');
export const getRecentTransactions      = () => api.get('/transactions');

export async function createZooUser({
    email, password, first_name, last_name, dept_id, role,
    license_no, specialty, specialization_species, office_location,
    shift_timeframe, pay_rate_cents, contact_info, manager_id,
}) {
    const result = await api.post('/employees', {
        email, password, first_name, last_name, dept_id, role,
        license_no, specialty, specialization_species, office_location,
        shift_timeframe, pay_rate_cents, contact_info, manager_id,
    });
    return result.employee_id;
}

export async function getFinancialRevenueBreakdown({ from, to } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to)   params.set('to',   to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const s = await api.get(`/dashboard/stats${qs}`);
    return [
        { name: 'Tickets',   Revenue: (s.ticket_revenue  ?? 0) / 100 },
        { name: 'Retail',    Revenue: (s.retail_revenue  ?? 0) / 100 },
        { name: 'Donations', Revenue: (s.total_donations ?? 0) / 100 },
    ];
}

export const tickets = {
    getAll: () => api.get('/tickets'),
};
