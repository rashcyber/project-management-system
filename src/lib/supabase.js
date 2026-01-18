import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // Configure redirect URLs for password recovery, email verification, etc.
    redirectTo: `${appUrl}/auth/callback`,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
