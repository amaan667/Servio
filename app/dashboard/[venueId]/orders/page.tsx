import OrdersClient from './OrdersClient';
import RoleBasedNavigation from '@/components/RoleBasedNavigation';
import { createClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function OrdersPage({ params }: { params: Promise<{ venueId: string }> }) {
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
            Order History
          </h1>
          <p className="text-lg text-foreground mt-2">
            View and manage past orders
          </p>
        </div>
        
        <OrdersClient venueId={venueId} />
      </div>
    </div>
  );
}