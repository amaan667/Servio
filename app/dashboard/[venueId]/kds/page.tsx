import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KDSClient from './KDSClient';
import { hasServerAuthCookie } from '@/lib/server-utils';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ venueId: string }>;
}

export default async function KDSPage({ params }: PageProps) {
  const { venueId } = await params;

  // Check for auth cookies before making auth calls
  const hasAuthCookie = await hasServerAuthCookie();
  
  if (!hasAuthCookie) {
    redirect('/sign-in');
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/sign-in');
  }

  // Verify user has access to this venue
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, name, owner_id')
    .eq('venue_id', venueId)
    .single();

  if (venueError || !venue) {
    redirect('/dashboard');
  }

  if (venue.owner_id !== user.id) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Kitchen Display System
          </h1>
          <p className="mt-2 text-muted-foreground">
            Monitor and manage kitchen orders for {venue.name}
          </p>
        </div>
        
        <KDSClient venueId={venueId} venueName={venue.name} />
      </div>
    </div>
  );
}

