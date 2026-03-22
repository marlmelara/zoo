import { supabase } from '../lib/supabase';
import { handleSupabaseResult } from '../utils/apiHandler';

export async function getAnimals() {
  const result = await supabase
    .from('animals')
    .select('*')
    .order('animal_id', { ascending: true });

  return handleSupabaseResult(result);
}

export async function getAnimalById(animalId) {
  const result = await supabase
    .from('animals')
    .select('*')
    .eq('animal_id', animalId)
    .single();

  return handleSupabaseResult(result, null);
}