export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import SignUpForm from './signup-form';

export default async function SignUpPage() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(all) { all.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard'); // don't show sign-up if logged in

  return <SignUpForm />; // render form without client-side waiting
}
