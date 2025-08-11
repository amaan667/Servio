export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import CompleteProfileForm from './form';

export default async function CompleteProfilePage() {
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
  if (!user) redirect('/sign-in');

  // Check if user already has a venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (venue?.venue_id) {
    redirect(`/dashboard/${venue.venue_id}`);
  }

  return <CompleteProfileForm user={user} />;
}
