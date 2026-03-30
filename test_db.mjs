import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wvdqpiyxjropqgayyizy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZHFwaXl4anJvcHFnYXl5aXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjU4MzUsImV4cCI6MjA4Njk0MTgzNX0.oo3u5hbWTesTmrHc8CBEVFrQ6VTxcIp1MXxs1fDlPpI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: empData, error: empError } = await supabase.from('employees').select('*, departments:departments!employees_dept_id_fkey(dept_name)');
  console.log('Employees Data Size:', empData?.length);
  if (empData && empData.length > 0) console.log('First employee department:', empData[0].departments);
  if (empError) console.log('Employees Error:', empError);
}

test();
