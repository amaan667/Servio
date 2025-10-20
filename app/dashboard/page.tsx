import React from 'react';
import { createClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // Only redirect if there's no user and no error (user genuinely not logged in)
  // If there's an error, let the page handle it
  if (!user && !userError) {
    redirect('/sign-in');
  }
  
  // If there's an error, don't redirect - let the page handle it
  if (userError) {
    console.error('[DASHBOARD] Auth error:', userError.message);
  }
  
  // If no user, return early
  if (!user) {
    return <div>Please sign in to access the dashboard</div>;
  }

  const { data: venues, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name, created_at')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true });

  if (venueError) {
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    redirect('/complete-profile');
  }

  const mainVenue = venues[0];
  redirect(`/dashboard/${mainVenue.venue_id}`);
}