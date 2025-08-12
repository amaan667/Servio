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
        // Keep this page read-only for cookies to avoid mutation during render
        set: () => {},
        remove: () => {},
      } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  // Resolve user's default destination: existing venue -> that dashboard, otherwise complete profile
  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .limit(1);

  if (venues && venues.length > 0) {
    redirect(`/dashboard/${venues[0].venue_id}`);
  }

  redirect('/complete-profile');
}
