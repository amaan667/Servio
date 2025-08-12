// lib/supabase.ts
'use client';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createClientComponentClient();

export async function signInWithGoogle() {
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) console.error('[AUTH] Google sign-in error:', error.message);
}