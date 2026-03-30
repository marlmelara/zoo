import { supabase } from '../lib/supabase';
import { handleSupabaseResult, sumCents } from '../utils/apiHandler';

/* ── Role-to-Department mapping ── */
export const ROLE_DEPT_MAP = {
  admin: 'Administration',
  manager: null, // manager picks their department
  vet: 'Veterinary Services',
  caretaker: 'Animal Care',
  security: 'Security',
  retail: 'Retail & Operations',
};

/* ── Admin Dashboard Stats ── */
export async function getAdminDashboardStats() {
  const [
    animalsRes,
    staffRes,
    customersRes,
    inventoryRes,
    eventsRes,
    ticketsRes,
    salesRes,
  ] = await Promise.all([
    supabase.from('animals').select('*', { count: 'exact', head: true }),
    supabase.from('employees').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('inventory').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('tickets').select('price_cents'),
    supabase.from('sale_items').select('quantity, price_at_sale_cents'),
  ]);

  if (animalsRes.error) throw animalsRes.error;
  if (staffRes.error) throw staffRes.error;
  if (customersRes.error) throw customersRes.error;
  if (inventoryRes.error) throw inventoryRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const tickets = handleSupabaseResult(ticketsRes);
  const sales = handleSupabaseResult(salesRes);

  const ticketRevenueCents = sumCents(tickets, 'price_cents');
  const retailRevenueCents = sales.reduce(
    (sum, s) => sum + s.quantity * s.price_at_sale_cents,
    0
  );

  return {
    totalAnimals: animalsRes.count ?? 0,
    totalEmployees: staffRes.count ?? 0,
    totalCustomers: customersRes.count ?? 0,
    totalInventory: inventoryRes.count ?? 0,
    totalEvents: eventsRes.count ?? 0,
    ticketRevenueCents,
    retailRevenueCents,
    totalRevenueCents: ticketRevenueCents + retailRevenueCents,
  };
}

/* ── Employee Directory ── */
export async function getEmployeesWithDepartments() {
  const result = await supabase
    .from('employees')
    .select('*, departments:departments!employees_dept_id_fkey(dept_name)')
    .order('employee_id', { ascending: true });

  return handleSupabaseResult(result);
}

/* ── Departments (for create-user form) ── */
export async function getDepartments() {
  const result = await supabase
    .from('departments')
    .select('*')
    .order('dept_id', { ascending: true });

  return handleSupabaseResult(result);
}

/* ── Create User via RPC ── */
export async function createZooUser({ email, password, first_name, last_name, dept_id, role }) {
  const { data, error } = await supabase.rpc('create_zoo_user', {
    email_param: email,
    password_param: password,
    first_name_param: first_name,
    last_name_param: last_name,
    department_id_param: parseInt(dept_id),
    role_param: role,
  });

  if (error) throw error;
  return data;
}
