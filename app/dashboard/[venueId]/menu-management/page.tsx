export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { MenuManagementWrapper } from '@/components/MenuManagementWrapper';

export default async function MenuManagementPage({ params }: { params: { venueId: string } }) {
  console.log('[MENU MANAGEMENT] Page mounted for venue', params.venueId);
  
  // SECURE: Use the secure authentication utility
  const { user, error } = await getAuthenticatedUser();
  
  if (error) {
    console.error('[MENU MANAGEMENT] Auth error:', error);
    redirect('/sign-in');
  }
  
  if (!user) {
    console.log('[MENU MANAGEMENT] No user found, redirecting to sign-in');
    redirect('/sign-in');
  }

  console.log('[MENU MANAGEMENT] User authenticated:', user.id);

  const supabase = await createServerSupabase();

  // Verify user owns this venue - try both venue_id and slug
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, name, slug, owner_id')
    .or(`venue_id.eq.${params.venueId},slug.eq.${params.venueId}`)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (venueError) {
    console.error('[MENU MANAGEMENT] Failed to load venue:', venueError);
    redirect('/dashboard');
  }

  if (!venue) {
    console.log('[MENU MANAGEMENT] Venue not found or user not owner, redirecting to dashboard');
    redirect('/dashboard');
  }

  console.log('[MENU MANAGEMENT] Venue loaded:', venue.name);
  console.log('[MENU MANAGEMENT] Venue details:', {
    venue_id: venue.venue_id,
    slug: venue.slug,
    params_venueId: params.venueId,
    name: venue.name
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={venue.venue_id} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Menu Management for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
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