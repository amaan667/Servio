export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import SignInForm from './signin-form';

export default async function SignInPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        get: n => cookieStore.get(n)?.value,
        set: (n,v,o) => cookieStore.set({ name:n, value:v, ...o }),
        remove: (n,o) => cookieStore.set({ name:n, value:'', ...o }),
      } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');
  return <SignInForm />;
}
