'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createClientComponentClient();

if (typeof window !== 'undefined') {
  let once = false;
  if (!once) {
    once = true;
    supabase.auth.onAuthStateChange((evt, sess) => {
      // eslint-disable-next-line no-console
      console.log('[AUTH DEBUG] client state', evt, { hasSession: !!sess, user: !!sess?.user });
    });
  }
}
