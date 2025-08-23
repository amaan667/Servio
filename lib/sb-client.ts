'use client';
import { createBrowserClient } from '@supabase/ssr';

// Log Supabase configuration
console.log('[SUPABASE-CLIENT] Initializing browser client...');
console.log('[SUPABASE-CLIENT] URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('[SUPABASE-CLIENT] Anon key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('[SUPABASE-CLIENT] URL length:', process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0);
console.log('[SUPABASE-CLIENT] Anon key length:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  const error = 'Missing required Supabase environment variables in browser client';
  console.error('[SUPABASE-CLIENT] ❌', error);
  // Note: We can't use errorLogger here since it's server-side only
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Enhanced logger to spot state flips in dev
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((evt, sess) => {
    console.log('[SUPABASE-CLIENT] Auth state change:', evt, { 
      hasSession: !!sess, 
      user: !!sess?.user,
      userEmail: sess?.user?.email,
      timestamp: new Date().toISOString()
    });
  });
}
