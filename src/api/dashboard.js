import api from '../lib/api';

export const ROLE_DEPT_MAP = {
    admin:     'Administration',
    manager:   null,
    vet:       'Veterinary Services',
    caretaker: 'Animal Care',
    security:  'Security',
    retail:    'Retail & Operations',
};

export const getAdminDashboardStats     = async () => {
    const s = await api.get('/dashboard/stats');
    return {
        totalRevenueCents:  s.total_revenue   || 0,
        ticketRevenueCents: s.ticket_revenue  || 0,
        retailRevenueCents: s.retail_revenue  || 0,
        totalEmployees:     s.total_employees || 0,
        totalAnimals:       s.total_animals   || 0,
        totalCustomers:     s.total_customers || 0,
    };
};
export const getEmployeesWithDepartments = () => api.get('/employees');
export const getDepartments             = () => api.get('/employees/departments/all');
export const getAnimalsWithZones        = () => api.get('/animals');
export const getRecentTransactions      = () => api.get('/transactions');

export async function createZooUser({ email, password, first_name, last_name, dept_id, role,
                                       license_no, specialty, specialization_species, office_location }) {
    const result = await api.post('/employees', {
        email, password, first_name, last_name, dept_id, role,
        license_no, specialty, specialization_species, office_location,
    });
    return result.employee_id;
}

export async function getFinancialRevenueBreakdown() {
    const s = await api.get('/dashboard/stats');
    return [
        { name: 'Tickets',   Revenue: (s.ticket_revenue  ?? 0) / 100 },
        { name: 'Retail',    Revenue: (s.retail_revenue  ?? 0) / 100 },
        { name: 'Donations', Revenue: (s.total_donations ?? 0) / 100 },
    ];
}

export const tickets = {
    getAll: () => api.get('/tickets'),
};
