import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

export async function getUpcomingEvents(limit = 6) {
  const today = new Date().toISOString().split('T')[0];

  const result = await supabase
    .from('events')
    .select('*, venues(venue_name, location)')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit);

  return handleSupabaseResult(result);
}

export async function getHomeStats() {
  const [animalsRes, eventsRes] = await Promise.all([
    supabase.from('animals').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
  ]);

  if (animalsRes.error) throw animalsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  return {
    animals: animalsRes.count ?? 0,
    events: eventsRes.count ?? 0,
  };
}