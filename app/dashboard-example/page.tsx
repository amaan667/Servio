import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import { redirect } from 'next/navigation';

export default async function DashboardExamplePage() {
  const cookieStore = await cookies();
  const names = cookieStore.getAll().map(c => c.name);
  if (!hasSupabaseAuthCookies(names)) {
    return <div>Please sign in.</div>;
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Please sign in.</div>;
  }

  return <div>Welcome, {user.email}</div>;
}
