export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import CompleteProfileForm from './form';

export default async function CompleteProfilePage() {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => jar.get(n)?.value,
        set: (n, v, o) => jar.set({ name: n, value: v, ...o }),
        remove: (n, o) => jar.set({ name: n, value: '', ...o }),
      },
    }
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) redirect('/sign-in');

  const { data: venue, error: venueErr } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (venueErr) {
    console.error('Error checking existing venue:', venueErr);
  }

  if (venue?.venue_id) {
    redirect(`/dashboard/${venue.venue_id}`);
  }

  return <CompleteProfileForm user={user} />;
}
