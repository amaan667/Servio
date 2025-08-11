export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export default async function DashboardPage() {
  const cookieStore = cookies(); // not await
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
  if (!user) redirect('/sign-in');

  // fetch any data here (watch RLS)
  return <main className="p-6"><h1 className="text-2xl font-semibold">Dashboard</h1></main>;
}
