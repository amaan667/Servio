'use client';

import { Suspense } from 'react';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <SignUpForm />
    </Suspense>
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import SignUpForm from './signup-form';

export default async function SignUpPage() {
  const cookieStore = cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookieStore.get(n)?.value,
        set: (n, v, o) => cookieStore.set({ name: n, value: v, ...o }),
        remove: (n, o) => cookieStore.set({ name: n, value: '', ...o }),
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard'); // don't show sign-up if logged in

  return <SignUpForm />; // render form without client-side waiting
}
