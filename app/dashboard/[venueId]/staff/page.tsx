import InvitationBasedStaffManagement from '@/components/staff/InvitationBasedStaffManagement';
import RoleBasedNavigation from '@/components/RoleBasedNavigation';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function StaffPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/sign-in');
  }

  // Check if user has access to this venue (owner or has role)
  const { data: userRole, error: roleError } = await supabase
    .from('user_venue_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('venue_id', venueId)
    .single();

  // Also check if user is the venue owner (for backward compatibility)
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name, owner_user_id')
    .eq('venue_id', venueId)
    .single();

  const isOwner = venue?.owner_user_id === user.id;
  const hasRole = userRole && ['owner', 'manager'].includes(userRole.role);

  if (venueError || !venue || (!isOwner && !hasRole)) {
    redirect('/complete-profile');
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
        
        <InvitationBasedStaffManagement 
          venueId={venueId} 
          venueName={venue.venue_name || "Your Venue"} 
        />
      </div>
    </div>
  );
}