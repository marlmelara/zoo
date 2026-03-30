import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wvdqpiyxjropqgayyizy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZHFwaXl4anJvcHFnYXl5aXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjU4MzUsImV4cCI6MjA4Njk0MTgzNX0.oo3u5hbWTesTmrHc8CBEVFrQ6VTxcIp1MXxs1fDlPpI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function signUpPablo() {
  const { data, error } = await supabase.auth.signUp({
    email: 'pablovelazquezbremont@gmail.com',
    password: 'admin123'
  });
  console.log("Signup Request:", error ? error.message : "Success");
}

signUpPablo();
