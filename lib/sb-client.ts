'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createClientComponentClient();

// OPTIONAL: small logger to spot state flips in dev
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((evt, sess) => {
    console.log('[AUTH DEBUG] client', evt, { hasSession: !!sess, user: !!sess?.user });
  });
}
