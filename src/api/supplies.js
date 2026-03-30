import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

/* ── Operational Supplies ── */

export async function getSuppliesByDepartment(deptId) {
  const result = await supabase
    .from('operational_supplies')
    .select('*')
    .eq('department_id', deptId)
    .order('supply_id', { ascending: true });

  return handleSupabaseResult(result);
}

export async function getAllOperationalSupplies() {
  const result = await supabase
    .from('operational_supplies')
    .select('*, departments(dept_name)')
    .order('supply_id', { ascending: true });

  return handleSupabaseResult(result);
}

/* ── Supply Requests ── */

export async function createSupplyRequest({ requested_by, supply_type, item_id, item_name, requested_quantity, reason }) {
  const result = await supabase
    .from('supply_requests')
    .insert([{
      requested_by,
      supply_type,
      item_id,
      item_name,
      requested_quantity,
      reason,
      status: 'pending'
    }])
    .select()
    .single();

  return handleSupabaseResult(result);
}

export async function getMySupplyRequests(employeeId) {
  const result = await supabase
    .from('supply_requests')
    .select('*, reviewer:reviewed_by(first_name, last_name)')
    .eq('requested_by', employeeId)
    .order('created_at', { ascending: false });

  return handleSupabaseResult(result);
}

export async function getPendingRequestsForManager(deptId) {
  // Get all pending requests from employees in this manager's department
  const result = await supabase
    .from('supply_requests')
    .select('*, requester:requested_by(first_name, last_name, dept_id, departments:departments!employees_dept_id_fkey(dept_name))')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const data = handleSupabaseResult(result);

  // Filter to only requests from employees in the manager's department
  // (admin/manager sees all)
  if (deptId) {
    return data.filter(r => r.requester?.dept_id === deptId);
  }
  return data;
}

export async function getAllSupplyRequests() {
  const result = await supabase
    .from('supply_requests')
    .select('*, requester:requested_by(first_name, last_name, departments:departments!employees_dept_id_fkey(dept_name)), reviewer:reviewed_by(first_name, last_name)')
    .order('created_at', { ascending: false });

  return handleSupabaseResult(result);
}

export async function reviewSupplyRequest(requestId, reviewerId, status) {
  const result = await supabase
    .from('supply_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString()
    })
    .eq('request_id', requestId)
    .select()
    .single();

  return handleSupabaseResult(result);
}

/* ── Restock operational supply (after approval) ── */
export async function restockOperationalSupply(supplyId, quantity) {
  // First get current stock
  const { data: current, error: fetchErr } = await supabase
    .from('operational_supplies')
    .select('stock_count')
    .eq('supply_id', supplyId)
    .single();

  if (fetchErr) throw fetchErr;

  const result = await supabase
    .from('operational_supplies')
    .update({ stock_count: current.stock_count + quantity })
    .eq('supply_id', supplyId);

  if (result.error) throw result.error;
  return true;
}
