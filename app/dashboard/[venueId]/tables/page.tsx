import { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import RoleBasedNavigation from '@/components/RoleBasedNavigation';
import { createClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

// Lazy load the heavy table management component
const TableManagementClientNew = dynamicImport(() => import('./table-management-client-new').then(mod => ({ default: mod.TableManagementClientNew })), {
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Tables</h2>
        <p className="text-gray-900">Setting up table management...</p>
      </div>
    </div>
  )
});

interface TableManagementPageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function TableManagementPage({ params }: TableManagementPageProps) {
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
        <Suspense fallback={<div className="text-center py-8 text-gray-900">Loading tables...</div>}>
          <TableManagementClientNew venueId={venueId} />
        </Suspense>
      </div>
    </div>
  );
}
