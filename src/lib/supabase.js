import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'zoo-auth',
    lock: async (name, acquireTimeout, fn) => {
      // Bypass navigator.locks to avoid NavigatorLockAcquireTimeoutError
      // in dev mode (React StrictMode double-mount causes lock stealing)
      return await fn()
    },
  }
})
