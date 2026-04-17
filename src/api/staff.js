import api from '../lib/api';

export const getStaff                = ()       => api.get('/employees');
export const getEmployeeById         = (id)     => api.get(`/employees/${id}`);
export const createEmployee          = (body)   => api.post('/employees', body);
export const updateEmployee          = (id, b)  => api.patch(`/employees/${id}`, b);
export const deleteEmployee          = (id)     => api.delete(`/employees/${id}`);
export const getDepartments          = ()       => api.get('/employees/departments/all');
export const getEmployeesWithDepartments = ()   => api.get('/employees');

// Replaces the create_zoo_user RPC
export async function createZooUser({ email, password, first_name, last_name, dept_id, role,
                                       license_no, specialty, specialization_species, office_location }) {
    const result = await api.post('/employees', {
        email, password, first_name, last_name, dept_id, role,
        license_no, specialty, specialization_species, office_location,
    });
    return result.employee_id;
}
