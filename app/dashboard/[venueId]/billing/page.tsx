import BillingClient from './billing-client';
import RoleBasedNavigation from '@/components/RoleBasedNavigation';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function BillingPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/sign-in');
  }

  // Check if user is the venue owner
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name, owner_user_id')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  // Check if user has a staff role for this venue
  const { data: userRole, error: roleError } = await supabase
    .from('user_venue_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .maybeSingle();

  const isOwner = !!venue;
  const isStaff = !!userRole;

  // If user is not owner or staff, redirect
  if (!isOwner && !isStaff) {
    redirect('/complete-profile');
  }

  // Get venue details for staff
  let finalVenue = venue;
  if (!venue && isStaff) {
    const { data: staffVenue } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', venueId)
      .single();
    
    if (!staffVenue) {
      redirect('/complete-profile');
    }
    finalVenue = staffVenue;
  }

  const finalUserRole = userRole?.role || (isOwner ? 'owner' : 'staff');
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation 
          venueId={venueId} 
          userRole={finalUserRole as any}
          userName={user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
        />
        
        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Billing & Subscription
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage your subscription and billing
          </p>
        </div>
        
        <BillingClient 
          venueId={venueId} 
          venueName={finalVenue?.venue_name || "Your Venue"}
          organization={{
            id: 'temp-org',
            subscription_tier: 'basic',
            subscription_status: 'active',
            trial_ends_at: null
          }}
          usage={{
            menuItems: 0,
            tables: 0,
            staff: 0,
            venues: 1
          }}
        />
      </div>
    </div>
  );
}