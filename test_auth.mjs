import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wvdqpiyxjropqgayyizy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZHFwaXl4anJvcHFnYXl5aXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjU4MzUsImV4cCI6MjA4Njk0MTgzNX0.oo3u5hbWTesTmrHc8CBEVFrQ6VTxcIp1MXxs1fDlPpI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignIn() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@zoo.com',
    password: 'admin123' 
  });
  console.log("Sign In result:", error ? error.message : data.session ? "Success!" : "No session");
}

testSignIn();
