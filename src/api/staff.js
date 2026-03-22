import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

export async function getStaff() {
  const result = await supabase
    .from('employees')
    .select(`
      employee_id,
      first_name,
      middle_name,
      last_name,
      role,
      contact_info,
      departments!employees_dept_id_fkey(dept_name)
    `)
    .order('employee_id', { ascending: true });

  return handleSupabaseResult(result);
}