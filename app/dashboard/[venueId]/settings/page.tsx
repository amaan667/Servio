export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { log } from '@/lib/debug';
import SettingsClient from '@/app/settings/SettingsClient.client';

export default async function VenueSettingsPage({
  params,
}: {
  params: { venueId: string };
}) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  log('VENUE SETTINGS SSR user', { hasUser: !!user });
  if (!user) return notFound();

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) return notFound();

  // Get user's venues for the settings component
  const { data: venues } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('owner_id', user.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Settings
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Manage your account and venue settings
        </p>
      </div>
      
      <SettingsClient user={user} venues={venues || []} />
    </div>
  );
}
