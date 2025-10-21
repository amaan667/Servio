import { POSDashboardClient } from './pos-dashboard-client';
import RoleBasedNavigation from '@/components/RoleBasedNavigation';
import { createServerSupabase } from '@/lib/supabase';

export default async function POSPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return <div>Please sign in to access POS</div>;
  }

  // Check if user is the venue owner
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, venue_name, owner_user_id')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  // Check if user has a staff role for this venue
  const { data: userRole } = await supabase
    .from('user_venue_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .maybeSingle();

  const isOwner = !!venue;
  const isStaff = !!userRole;

  // If user is not owner or staff, show error
  if (!isOwner && !isStaff) {
    return <div>You don&apos;t have access to this venue</div>;
  }

  // Get venue details if user is staff
  if (!venue && isStaff) {
    const { data: staffVenue } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', venueId)
      .single();
    
    if (!staffVenue) {
      return <div>Venue not found</div>;
    }
  }

  const finalUserRole = userRole?.role || (isOwner ? 'owner' : 'staff');
  const canAccessPOS = finalUserRole === 'owner' || finalUserRole === 'manager' || finalUserRole === 'server' || finalUserRole === 'cashier';
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation 
          venueId={venueId} 
          userRole={finalUserRole as unknown}
          userName={user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
        />
        
        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Point of Sale
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage tables, orders, and payments
          </p>
        </div>
        
        {canAccessPOS ? (
          <POSDashboardClient venueId={venueId} />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Access Restricted</h3>
            <p className="text-yellow-700">You don&apos;t have permission to access the Point of Sale system. This feature is available for Owner, Manager, Server, and Cashier roles only.</p>
          </div>
        )}
      </div>
    </div>
  );
}
