import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

export async function getAdminEvents() {
  const result = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });

  return handleSupabaseResult(result);
}

export async function getUpcomingEvents(limit = 6) {
  const today = new Date().toISOString().split('T')[0];

  const result = await supabase
    .from('events')
    .select('*')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit);

  return handleSupabaseResult(result);
}

export async function getEventAssignments(eventId) {
  const result = await supabase
    .from('event_assignments')
    .select(`
      assignment_id,
      employees (
        first_name,
        last_name,
        departments!employees_dept_id_fkey(dept_name)
      ),
      animals (
        name,
        species_common_name
      )
    `)
    .eq('event_id', eventId);

  return handleSupabaseResult(result);
}

export async function assignResourceToEvent({
  event_id,
  employee_id = null,
  animal_id = null,
}) {
  const result = await supabase
    .from('event_assignments')
    .insert([{ event_id, employee_id, animal_id }])
    .select();

  return handleSupabaseResult(result, null);
}