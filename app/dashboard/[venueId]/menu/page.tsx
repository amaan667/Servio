export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import MenuClient from './MenuClient';

export default async function MenuPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[MENU] Page mounted for venue', params.venueId);
  
  const supabase = createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  log('MENU SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={params.venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Menu for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Manage your menu items and categories
          </p>
        </div>
        
        <MenuClient venueId={params.venueId} />
      </div>
    </div>
  );
}
