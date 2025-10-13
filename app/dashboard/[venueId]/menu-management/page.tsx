export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { MenuManagementWrapper } from '@/components/MenuManagementWrapper';

export default async function MenuManagementPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  // SECURE: Use the secure authentication utility
  const { user, error } = await getAuthenticatedUser();
  
  if (error) {
    console.error('[MENU MANAGEMENT] Auth error:', error);
    redirect('/sign-in');
  }
  
  if (!user) {
    redirect('/sign-in');
  }


  const supabase = await createServerSupabase();

  // Verify user owns this venue - try both venue_id and slug
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name, slug, owner_user_id')
    .or(`venue_id.eq.${venueId},slug.eq.${venueId}`)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (venueError) {
    console.error('[MENU MANAGEMENT] Failed to load venue:', venueError);
    redirect('/dashboard');
  }

  if (!venue) {
    redirect('/dashboard');
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={venue.venue_id} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Menu Management for {venue.venue_name}
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage your menu items and categories
          </p>
        </div>
        
        <MenuManagementWrapper 
          venueId={venue.venue_id} 
          session={{ user, venue: { id: venue.venue_id, venue_id: venue.venue_id } }} 
        />
      </div>
    </div>
  );
}