'use client';
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// OPTIONAL: small logger to spot state flips in dev
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((evt, sess) => {
    console.log('[AUTH DEBUG] client', evt, { hasSession: !!sess, user: !!sess?.user });
  });
}
