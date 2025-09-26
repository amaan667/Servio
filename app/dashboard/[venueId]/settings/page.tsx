export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase/server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import VenueSettingsClient from './VenueSettingsClient';

export default async function VenueSettings({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Get full user data with identities using admin client
    let fullUserData = user;
    if (user) {
      try {
        const adminClient = createAdminClient();
        const { data: adminUser, error: adminError } = await adminClient.auth.admin.getUserById(user.id);
        if (!adminError && adminUser.user) {
          fullUserData = adminUser.user;
          log('SETTINGS SSR admin user data', { 
            hasIdentities: !!adminUser.user.identities,
            identities: adminUser.user.identities,
            userMetadata: adminUser.user.user_metadata,
            appMetadata: adminUser.user.app_metadata
          });
        }
      } catch (error) {
        console.error('[SETTINGS] Error getting admin user data:', error);
      }
    }
    
    log('SETTINGS SSR user', { 
      hasUser: !!user, 
      error: userError?.message, 
      hasIdentities: !!fullUserData?.identities,
      userMetadata: fullUserData?.user_metadata,
      appMetadata: fullUserData?.app_metadata,
      createdAt: fullUserData?.created_at,
      emailConfirmedAt: fullUserData?.email_confirmed_at
    });
    
    if (userError) {
      console.error('[SETTINGS] Auth error:', userError);
      redirect('/sign-in');
    }
    
    if (!user) {
      redirect('/sign-in');
    }

    // Verify user owns this venue and get full venue data
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name, email, phone, address')
      .eq('venue_id', venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[SETTINGS] Venue query error:', venueError);
      redirect('/dashboard');
    }

    if (!venue) {
      redirect('/dashboard');
    }

    // Get all user's venues for the client component
    const { data: venues } = await supabase
      .from('venues')
      .select('venue_id, name, email, phone, address')
      .eq('owner_id', user.id);

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
          <NavigationBreadcrumb venueId={venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Settings for {venue.name}
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Manage your venue settings and preferences
            </p>
          </div>
          
          <VenueSettingsClient 
            user={fullUserData || user} 
            venue={venue} 
            venues={venues || []} 
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('[SETTINGS] Unexpected error:', error);
    redirect('/sign-in');
  }
}
