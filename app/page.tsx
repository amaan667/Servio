export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export default async function HomePage() {
  // Server-side authentication check without session mutation
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: () => {}, // No cookie mutation on GET
        remove: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // User is signed in, redirect to dashboard
    redirect('/dashboard');
  } else {
    // User is not signed in, redirect to sign-in
    redirect('/sign-in');
  }
}
