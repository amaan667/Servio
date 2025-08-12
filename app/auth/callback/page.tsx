// app/auth/callback/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export default async function AuthCallbackPage() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
      },
    }
  );

  const { searchParams } = new URL(
    process.env.NEXT_PUBLIC_APP_URL + '/auth/callback' + '?' + globalThis.location?.search || ''
  );

  const code = searchParams.get('code');
  if (!code) {
    console.error('[AUTH CALLBACK] No code in URL');
    redirect('/sign-in');
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[AUTH CALLBACK] Exchange error', error.message);
    redirect('/sign-in');
  }

  // ✅ Successfully signed in, go to dashboard
  redirect('/dashboard');
}
