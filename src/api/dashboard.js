import api from '../lib/api';

export const ROLE_DEPT_MAP = {
    admin:     'Administration',
    manager:   null,
    vet:       'Veterinary Services',
    caretaker: 'Animal Care',
    security:  'Security',
    retail:    'Retail & Operations',
};

export const getAdminDashboardStats     = () => api.get('/dashboard/stats');
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
    const stats = await api.get('/dashboard/stats');
    // Stats endpoint returns aggregated data; build chart-friendly format
    return [
        { name: 'Tickets',  Revenue: (stats.total_revenue ?? 0) / 100 },
        { name: 'Donations', Revenue: (stats.total_donations ?? 0) / 100 },
    ];
}

export const tickets = {
    getAll: () => api.get('/tickets'),
};
