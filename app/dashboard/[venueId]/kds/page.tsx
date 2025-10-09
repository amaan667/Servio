import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KDSClient from './KDSClient';
import { hasServerAuthCookie } from '@/lib/server-utils';

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

  return <KDSClient venueId={venueId} venueName={venue.name} />;
}

