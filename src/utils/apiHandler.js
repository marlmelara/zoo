export function handleSupabaseResult(result, fallback = []) {
  const { data, error } = result;

  if (error) {
    console.error('Supabase error:', error);
    throw error;
  }

  return data ?? fallback;
}

export function sumCents(rows, field) {
  return (rows ?? []).reduce((sum, row) => sum + (row?.[field] ?? 0), 0);
}