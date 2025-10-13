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
    const supabase = await createServerSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    
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
      hasIdentities: !!fullUserData?.identities,
      userMetadata: fullUserData?.user_metadata,
      appMetadata: fullUserData?.app_metadata,
      createdAt: fullUserData?.created_at,
      emailConfirmedAt: fullUserData?.email_confirmed_at
    });
    
    if (!user) return null;

    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id, venue_name, email, phone, address, timezone, venue_type, service_type, operating_hours, latitude, longitude')
      .eq('venue_id', venueId)
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (!venue) return null;

    // Get all user's venues for the client component
    const { data: venues } = await supabase
      .from('venues')
      .select('venue_id, venue_name, email, phone, address, timezone, venue_type, service_type, operating_hours, latitude, longitude')
      .eq('owner_user_id', user.id);

    // Get organization data for billing
    const { data: organization } = await supabase
      .from('organizations')
      .select('id, subscription_tier, is_grandfathered, stripe_customer_id, subscription_status, trial_ends_at')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
          <NavigationBreadcrumb venueId={venueId} />
          
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Settings for {venue.venue_name}
            </h1>
            <p className="text-lg text-foreground mt-2">
              Manage your venue settings and preferences
            </p>
          </div>
          
          <VenueSettingsClient 
            user={fullUserData || user} 
            venue={venue} 
            venues={venues || []} 
            organization={organization}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('[SETTINGS] Unexpected error:', error);
    return null;
  }
}
