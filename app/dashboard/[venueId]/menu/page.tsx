export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { safeGetUser } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import dynamicImport from 'next/dynamic';

// Lazy load the heavy MenuClient component for better performance
const MenuClient = dynamicImport(() => import('./MenuClient'), {
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Menu</h2>
        <p className="text-gray-700">Setting up your menu management...</p>
      </div>
    </div>
  )
});

export default async function MenuPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  
  // Safe auth check that only calls getUser if auth cookies exist
  const { data: { user }, error } = await safeGetUser();
  
  if (error) {
    console.error('[MENU] Auth error:', error);
    redirect('/sign-in');
  }
  
  if (!user) {
    redirect('/sign-in');
  }

  log('MENU SSR user', { hasUser: !!user });

  const supabase = await createServerSupabase();

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, venue_name')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Menu for {venue.venue_name}
          </h1>
        <p className="text-lg text-foreground mt-2">
          Manage your menu items and categories
        </p>
        </div>
        
        <MenuClient venueId={venueId} venueName={venue.venue_name} />
      </div>
    </div>
  );
}
