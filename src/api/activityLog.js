import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

/* ── Log an activity ── */
export async function logActivity({ action_type, description, performed_by, target_type, target_id, metadata }) {
  const result = await supabase
    .from('activity_log')
    .insert([{
      action_type,
      description,
      performed_by,
      target_type,
      target_id,
      metadata: metadata || {}
    }])
    .select()
    .single();

  return handleSupabaseResult(result);
}

/* ── Get recent activity (for manager/admin dashboards) ── */
export async function getRecentActivity(limit = 20) {
  const result = await supabase
    .from('activity_log')
    .select('*, performer:performed_by(first_name, last_name, role)')
    .order('created_at', { ascending: false })
    .limit(limit);

  return handleSupabaseResult(result);
}

/* ── Get activity for a specific department's employees ── */
export async function getDepartmentActivity(deptId, limit = 20) {
  // Get employee IDs in this department first
  const { data: deptEmployees } = await supabase
    .from('employees')
    .select('employee_id')
    .eq('dept_id', deptId);

  const empIds = (deptEmployees || []).map(e => e.employee_id);
  if (empIds.length === 0) return [];

  const result = await supabase
    .from('activity_log')
    .select('*, performer:performed_by(first_name, last_name, role)')
    .in('performed_by', empIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  return handleSupabaseResult(result);
}

/* ── Get activity by a specific employee ── */
export async function getMyActivity(employeeId, limit = 20) {
  const result = await supabase
    .from('activity_log')
    .select('*')
    .eq('performed_by', employeeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return handleSupabaseResult(result);
}
